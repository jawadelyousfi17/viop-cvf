'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from 'tldraw'
import { estimateNarrationSeconds, holdInsideParents, type Lesson } from '@/lib/lesson'
import type { LessonEvent } from '@/lib/lesson-stream'
import type { Engine } from '@/lib/engines'
import type { Provider } from '@/lib/providers'
import { DEFAULT_VOICE_ID, VOICES, type VoiceId } from '@/lib/voices'
import type { BoardPainter } from './paint'
import { ImageBank } from '../images'
import { CHART_KINDS, chartKey } from '@/lib/chart'
import { renderChart } from '../charts'
import { Narrator } from '../narrator'
import { parseScript } from '@/lib/script-import'
import type { SavedScript } from '@/app/api/scripts/route'

// tldraw is browser-only and heavy — keep it out of the server bundle and off
// the critical path for the topic screen.
const Board = dynamic(() => import('./board'), { ssr: false })

const SUGGESTIONS = [
  'How does HTTPS actually keep my traffic private?',
  'Why do neural networks need activation functions?',
  'The Krebs cycle, but only the parts that matter',
  'What causes the northern lights?',
]

const LOADING_LINES = [
  'Reading up on your topic…',
  'Sketching out the board…',
  'Deciding what to draw first…',
]

type Phase = 'idle' | 'generating' | 'board'

/** Every picture a scene will need, photographs and symbols alike. */
function imageQueries(scene: { shapes: { kind: string; text: string }[] }) {
  return scene.shapes
    .filter((s) => (s.kind === 'image' || s.kind === 'symbol') && s.text.trim())
    .map((s) => ({ query: s.text, kind: s.kind as 'image' | 'symbol' }))
}

/** Reads the route's newline-delimited JSON events as they arrive. */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<LessonEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.trim()) yield JSON.parse(line) as LessonEvent
      }
    }
    if (buffer.trim()) yield JSON.parse(buffer) as LessonEvent
  } finally {
    reader.releaseLock()
  }
}

export default function Studio({
  engine,
  provider,
  model,
  chooser,
}: {
  engine: Engine
  provider: Provider
  model: string
  chooser: React.ReactNode
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [topic, setTopic] = useState('')
  /** A finished script to draw, instead of a topic to invent one for. */
  const [script, setScript] = useState('')
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** The lesson title, shown on the loading screen before scene one arrives. */
  const [pendingTitle, setPendingTitle] = useState<string | null>(null)

  const [sceneIndex, setSceneIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [finished, setFinished] = useState(false)
  const [hasVoice, setHasVoice] = useState(true)
  const [voiceId, setVoiceId] = useState<VoiceId>(DEFAULT_VOICE_ID)
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  /** Suggested next topics, fetched once the lesson has fully streamed in. */
  const [followups, setFollowups] = useState<string[]>([])
  /**
   * Everything taught this session, oldest first. Threaded into each new
   * lesson so a series builds instead of restarting from scratch each time.
   */
  const [history, setHistory] = useState<{ title: string; summary: string }[]>([])

  const editorRef = useRef<Editor | null>(null)
  const painterRef = useRef<BoardPainter | null>(null)
  const narratorRef = useRef<Narrator | null>(null)
  const imagesRef = useRef<ImageBank | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef(false)
  const penRef = useRef<HTMLDivElement>(null)
  const [painterReady, setPainterReady] = useState(false)

  // The lesson grows while it plays, so the animation loop reads it through a
  // ref. Depending on the `lesson` object itself would restart the current
  // scene every time a new one streams in.
  const lessonRef = useRef<Lesson | null>(null)
  const waitingRef = useRef(false)
  const streamingRef = useRef(false)
  /** Bumped per lesson so a stale stream can't write into a newer one. */
  const runIdRef = useRef(0)

  // Mirrors `isPlaying` where the animation loop can read it, and keeps the
  // audio element in step with the play/pause button. Declared before the scene
  // effect so the ref is already correct when a new scene starts.
  useEffect(() => {
    playingRef.current = isPlaying
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) void audio.play().catch(() => setIsPlaying(false))
    else audio.pause()
  }, [isPlaying, sceneIndex])

  // Must stay synchronous: tldraw treats whatever `onMount` returns as an
  // unmount cleanup function, so returning a promise crashes the editor.
  const onEditor = useCallback((editor: Editor) => {
    editorRef.current = editor
    void import('./paint').then(({ BoardPainter }) => {
      const painter = new BoardPainter(editor)
      painter.attachPen(penRef.current)
      painterRef.current = painter
      setPainterReady(true)
    })
  }, [])

  useEffect(() => {
    return () => {
      narratorRef.current?.dispose()
      audioRef.current?.pause()
    }
  }, [])

  const start = useCallback((next: Lesson) => {
    narratorRef.current?.dispose()
    narratorRef.current = new Narrator(voiceId)
    imagesRef.current = new ImageBank()
    painterRef.current?.reset()

    lessonRef.current = next
    waitingRef.current = false

    // Kick the first voiceover off now rather than when the scene effect runs:
    // it overlaps the TTS request with tldraw mounting, which is otherwise
    // several seconds of dead time.
    if (next.scenes[0]) {
      narratorRef.current.prefetch(0, next.scenes[0].narration)
      imagesRef.current.prefetch(imageQueries(next.scenes[0]))
    }

    setFollowups([])
    setLesson(next)
    setSceneIndex(0)
    setFinished(false)
    setHasVoice(true)
    setIsPlaying(true)
    setPhase('board')
  }, [voiceId])

  /** Appends a streamed scene and, if playback was holding for it, resumes. */
  const addScene = useCallback((event: Extract<LessonEvent, { type: 'scene' }>) => {
    const current = lessonRef.current
    if (!current) return

    // Image lookups are slow — a search, a proxied fetch and a decode. Starting
    // them the moment a scene arrives rather than when it plays usually buys
    // enough head start for the picture to beat the narration to it.
    imagesRef.current?.prefetch(imageQueries(event.scene))

    const scenes = [...current.scenes, event.scene]
    const next = { ...current, scenes }
    lessonRef.current = next
    setLesson(next)

    if (waitingRef.current) {
      waitingRef.current = false
      setSceneIndex(scenes.length - 1)
    }
  }, [])

  // `/?demo=1` plays a hand-written lesson, so the board can be seen working
  // before any keys are set up.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('demo')) return
    void import('@/lib/demo-lesson').then(({ DEMO_LESSON }) => start(DEMO_LESSON))
  }, [start])

  async function generate(nextTopic: string, script?: string) {
    const trimmed = nextTopic.trim()
    const scripted = script?.trim() ?? ''
    if (!trimmed && !scripted) return

    const runId = ++runIdRef.current
    const isCurrent = () => runIdRef.current === runId

    setError(null)
    setPendingTitle(null)
    setPhase('generating')

    let started = false
    let pendingMeta: Extract<LessonEvent, { type: 'meta' }> | null = null

    const fail = (message: string) => {
      if (!isCurrent()) return
      // Once the board is up, a late failure just stops the lesson early —
      // whatever already streamed in stays playable.
      if (started) streamingRef.current = false
      else {
        setError(message)
        setPhase('idle')
      }
    }

    try {
      const response = await fetch('/api/lesson', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: trimmed, script: scripted, history, engine, provider, model }),
      })

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? `Request failed (${response.status})`)
      }
      streamingRef.current = true

      for await (const event of readEvents(response.body)) {
        if (!isCurrent()) return

        if (event.type === 'meta') {
          if (started) setLesson((prev) => (prev ? { ...prev, title: event.title } : prev))
          else {
            // Arrives a few seconds before scene one — show it so the wait has
            // something to say for itself.
            pendingMeta = event
            setPendingTitle(event.title)
          }
        } else if (event.type === 'scene') {
          if (!started) {
            started = true
            start({
              title: pendingMeta?.title || trimmed || 'Your script',
              summary: pendingMeta?.summary ?? '',
              scenes: [event.scene],
            })
          } else {
            addScene(event)
          }
        } else if (event.type === 'error') {
          fail(event.message)
          return
        }
      }

      if (!isCurrent()) return
      if (!started) throw new Error('The model returned a lesson with no scenes.')
      streamingRef.current = false

      const finishedLesson = lessonRef.current
      if (finishedLesson) {
        setHistory((prev) => [
          ...prev,
          { title: finishedLesson.title, summary: finishedLesson.summary },
        ])

        // Nobody is waiting on these; a failure just means no suggestions.
        void fetch('/api/followups', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ lesson: finishedLesson }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (isCurrent()) setFollowups(data.questions ?? [])
          })
          .catch(() => {})
      }

      // Playback was holding for a scene that will now never arrive.
      if (waitingRef.current) {
        waitingRef.current = false
        setIsPlaying(false)
        setFinished(true)
      }
    } catch (cause) {
      streamingRef.current = false
      fail(cause instanceof Error ? cause.message : 'Something went wrong.')
    }
  }

  const scene = lesson?.scenes[sceneIndex]
  const sceneId = scene?.id

  // Scene lifecycle: move the camera, start the narration, and reveal shapes as
  // the voice reaches them. Pause/resume is handled inside the loop so it never
  // restarts the scene, and it keys off the scene's id rather than the lesson
  // so newly streamed scenes don't interrupt the one playing.
  useEffect(() => {
    const painter = painterRef.current
    const narrator = narratorRef.current
    if (phase !== 'board' || !painter || !narrator) return

    const scene = lessonRef.current?.scenes[sceneIndex]
    if (!scene) return

    let cancelled = false
    let frame = 0
    let audio: HTMLAudioElement | null = null

    // Open tight on whatever leads the scene, then let maybeReframe pull back
    // as the board fills. Framing everything up front gives a static wide shot.
    // Open on the whole scene now that content is centred in the board, then
    // let maybeReframe follow the work as it fills in.
    // Sketch the link down from the previous scene, so the scroll reads as one
    // continuous board rather than a stack of separate pages.
    if (sceneIndex > 0) painter.connect(sceneIndex - 1)

    painter.focus(sceneIndex, scene.shapes)

    // Image lookups run in parallel with the voiceover, so a picture is
    // usually decoded before the narration reaches it.
    const bank = imagesRef.current
    if (bank) {
      for (const shape of scene.shapes) {
        if ((shape.kind !== 'image' && shape.kind !== 'symbol') || !shape.text.trim()) continue
        void bank.get(shape.text, shape.kind).then((found) => {
          if (!cancelled && found) painter.addImage(shape.text, found)
        })
      }
    }

    // Charts are rasterised server-side and arrive the same way a photograph
    // does: a dashed frame first, the picture when it lands.
    for (const shape of scene.shapes) {
      if (!(CHART_KINDS as readonly string[]).includes(shape.kind) || !shape.data.length) continue
      void renderChart(shape).then((found) => {
        if (!cancelled && found) painter.addImage(chartKey(sceneIndex, shape.id), found)
      })
    }

    // Anything due at the very first word is drawn before the audio resolves,
    // otherwise the board sits blank for as long as the voice takes to fetch.
    // Scenes no longer open with a title, so if nothing is scheduled at zero,
    // draw whichever shape comes first rather than leaving the canvas empty.
    const opensAt = scene.shapes.filter((s) => s.at <= 0.001 && !s.anchor)
    const first = opensAt.length ? opensAt : scene.shapes.slice(0, 1)
    for (const shape of first) painter.paint(sceneIndex, shape, scene.shapes)

    // Drawing starts immediately on an estimated clock rather than waiting for
    // the voiceover. TTS takes several seconds — longer when six scenes' worth
    // of audio and images are in flight — and gating the board on it left the
    // canvas showing a single shape until the audio landed.
    let duration = estimateNarrationSeconds(scene.narration)
    let schedule = holdInsideParents(
      scene.shapes.map((shape) => ({ shape, time: shape.at * duration }))
    )

    void narrator.get(sceneIndex, scene.narration).then((narration) => {
      if (cancelled) return

      audio = narration.audio
      audioRef.current = audio
      duration = narration.duration
      setHasVoice(narrator.hasVoice)

      // Re-time against the real clip: anchored shapes now land on their words.
      schedule = holdInsideParents(
        scene.shapes.map((shape) => {
          const anchored = shape.anchor ? narration.timeOf(shape.anchor) : null
          return { shape, time: anchored ?? shape.at * narration.duration }
        })
      )

      const next = lessonRef.current?.scenes[sceneIndex + 1]
      if (next) narrator.prefetch(sceneIndex + 1, next.narration)

      if (audio) {
        // From the top, so the learner hears the whole scene. Anything already
        // drawn during the silent lead simply stays put.
        audio.currentTime = 0
        if (playingRef.current) void audio.play().catch(() => setIsPlaying(false))
      }
    })

    void (async () => {
      let elapsed = 0
      let last = performance.now()
      let advanced = false

      const tick = (now: number) => {
        if (cancelled) return

        const delta = (now - last) / 1000
        last = now
        if (playingRef.current) elapsed += delta

        const seconds = audio ? audio.currentTime : elapsed
        const fraction = Math.min(1, seconds / Math.max(0.1, duration))

        for (const entry of schedule) {
          if (entry.time <= seconds) painter.paint(sceneIndex, entry.shape, scene.shapes)
        }

        const ended = audio ? audio.ended || fraction >= 1 : fraction >= 1
        if (ended && !advanced) {
          advanced = true
          const total = lessonRef.current?.scenes.length ?? 0

          if (sceneIndex + 1 < total) {
            setSceneIndex(sceneIndex + 1)
          } else if (streamingRef.current) {
            // Playback has outrun the model. Hold here; `addScene` resumes us
            // the moment the next scene lands.
            waitingRef.current = true
          } else {
            setIsPlaying(false)
            setFinished(true)
          }
          return
        }

        frame = requestAnimationFrame(tick)
      }

      frame = requestAnimationFrame(tick)
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      audio?.pause()
      if (audioRef.current === audio) audioRef.current = null
    }
  }, [phase, sceneIndex, sceneId, painterReady])

  const goToScene = useCallback(
    (index: number) => {
      const painter = painterRef.current
      if (!lesson || !painter) return

      const target = Math.max(0, Math.min(lesson.scenes.length - 1, index))

      // Skipping forward shouldn't leave holes in the board: fill in every
      // earlier scene at once, without the fade-in choreography.
      for (let i = 0; i < target; i++) {
        for (const shape of lesson.scenes[i].shapes) {
          painter.paint(i, shape, lesson.scenes[i].shapes, false)
        }
      }

      waitingRef.current = false
      setFinished(false)
      setSceneIndex(target)
    },
    [lesson]
  )

  /**
   * Answers a question mid-lesson.
   *
   * The answer is inserted as a scene directly after the one playing, so the
   * board pans to fresh space, draws the answer, and then carries on into the
   * scene that was coming next. Inserting after the current index is safe:
   * every later scene is unpainted, so renumbering them costs nothing.
   */
  async function ask() {
    const text = question.trim()
    const current = lessonRef.current
    if (!text || !current || asking) return

    setAsking(true)
    setIsPlaying(false)

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: text,
          title: current.title,
          current: current.scenes[sceneIndex]?.narration ?? '',
          engine,
          provider,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error ?? `Request failed (${response.status})`)

      const scenes = [...current.scenes]
      scenes.splice(sceneIndex + 1, 0, data.scene)
      const next = { ...current, scenes }
      lessonRef.current = next

      setLesson(next)
      setQuestion('')
      setFinished(false)
      setSceneIndex(sceneIndex + 1)
      setIsPlaying(true)
    } catch (cause) {
      console.error('[ask]', cause)
      setIsPlaying(true)
    } finally {
      setAsking(false)
    }
  }

  /**
   * Swaps the narration voice. The scene already playing keeps its audio —
   * cutting it off mid-sentence would be worse than finishing in the old voice
   * — but everything cached ahead is dropped so the next scene speaks in the
   * new one.
   */
  function changeVoice(next: VoiceId) {
    setVoiceId(next)
    narratorRef.current?.setVoice(next)
  }

  function restart() {
    painterRef.current?.reset()
    waitingRef.current = false
    setFinished(false)
    setSceneIndex(0)
    setIsPlaying(true)
  }

  function newLesson() {
    // Bumping the run id makes any in-flight stream stop writing into state.
    runIdRef.current++
    streamingRef.current = false
    waitingRef.current = false
    lessonRef.current = null

    setIsPlaying(false)
    setPhase('idle')
    setLesson(null)
    setFinished(false)
    painterRef.current?.reset()
    narratorRef.current?.dispose()
    narratorRef.current = null
  }

  if (phase !== 'board') {
    return (
      <TopicScreen
        topic={topic}
        setTopic={setTopic}
        onSubmit={generate}
        script={script}
        setScript={setScript}
        busy={phase === 'generating'}
        pendingTitle={pendingTitle}
        error={error}
        chooser={chooser}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-white">
      <Board onEditor={onEditor} />

      {/* The pen. Positioned by the painter directly, in screen pixels, so it
          tracks the trace at frame rate without re-rendering React. */}
      <div
        ref={penRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-10 transition-opacity duration-200"
        style={{ opacity: 0 }}
      >
        <svg viewBox="0 0 32 32" className="size-8 -translate-x-1 -translate-y-7 drop-shadow-sm">
          <path
            d="M6 26.5 8.2 20l14-14a3 3 0 0 1 4.2 4.2l-14 14L6 26.5Z"
            fill="#fafafa"
            stroke="#27272a"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M8.2 20l4.2 4.2" stroke="#27272a" strokeWidth="1.4" />
          <path d="M6 26.5 8.2 24l2 2-4.2.5Z" fill="#27272a" />
        </svg>
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-end p-4">
        <button
          type="button"
          onClick={newLesson}
          className="pointer-events-auto rounded-xl border border-black/10 bg-white/90 px-3.5 py-2.5 text-sm font-medium text-zinc-700 shadow-sm backdrop-blur transition hover:bg-white hover:text-zinc-900"
        >
          New topic
        </button>
      </header>

      {/* Where to go next. Only once the lesson has finished playing — offered
          mid-lesson they compete with the thing being explained. */}
      {finished && followups.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-5">
          <div className="pointer-events-auto flex max-w-3xl flex-wrap justify-center gap-2">
            {followups.map((next) => (
              <button
                key={next}
                type="button"
                onClick={() => {
                  setTopic(next)
                  void generate(next)
                }}
                className="rounded-full border border-black/10 bg-white/95 px-4 py-2 text-sm text-zinc-700 shadow-sm backdrop-blur transition hover:border-zinc-300 hover:text-zinc-900"
              >
                {next}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Transport only. The board carries the lesson; a caption panel just
          competes with the thing it is describing. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-5">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-black/10 bg-white/90 px-3 py-2 shadow-lg shadow-black/5 backdrop-blur">
            <IconButton
              label="Previous scene"
              onClick={() => goToScene(sceneIndex - 1)}
              disabled={sceneIndex === 0}
            >
              <path d="M14 5 8 10l6 5V5Z" />
              <path d="M6 5v10" />
            </IconButton>

            <button
              type="button"
              onClick={() => (finished ? restart() : setIsPlaying((value) => !value))}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-700"
              aria-label={finished ? 'Replay lesson' : isPlaying ? 'Pause' : 'Play'}
            >
              {finished ? (
                <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 10a6 6 0 1 1-1.8-4.3" />
                  <path d="M15 3v3h-3" />
                </svg>
              ) : isPlaying ? (
                <svg viewBox="0 0 20 20" className="size-5" fill="currentColor">
                  <rect x="6" y="5" width="3" height="10" rx="1" />
                  <rect x="11" y="5" width="3" height="10" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" className="size-5" fill="currentColor">
                  <path d="M7 4.8v10.4a.8.8 0 0 0 1.22.68l8.2-5.2a.8.8 0 0 0 0-1.36l-8.2-5.2A.8.8 0 0 0 7 4.8Z" />
                </svg>
              )}
            </button>

            <IconButton
              label="Next scene"
              onClick={() => goToScene(sceneIndex + 1)}
              disabled={!lesson || sceneIndex >= lesson.scenes.length - 1}
            >
              <path d="M6 5l6 5-6 5V5Z" />
              <path d="M14 5v10" />
            </IconButton>

            <span className="mx-1 h-6 w-px bg-black/10" />

            <form
              onSubmit={(event) => {
                event.preventDefault()
                void ask()
              }}
            >
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={asking}
                maxLength={400}
                placeholder={asking ? 'Working it out…' : 'Ask a question…'}
                aria-label="Ask a question about this lesson"
                className="w-52 rounded-full bg-zinc-100 px-4 py-2 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:bg-zinc-50 focus:ring-2 focus:ring-zinc-900/10 disabled:animate-pulse"
              />
            </form>

            <span className="mx-1 h-6 w-px bg-black/10" />

            <VoicePicker value={voiceId} onChange={changeVoice} disabled={!hasVoice} />

        </div>
      </div>
    </div>
  )
}

function VoicePicker({
  value,
  onChange,
  disabled,
}: {
  value: VoiceId
  onChange: (id: VoiceId) => void
  disabled?: boolean
}) {
  return (
    <label className="relative flex items-center">
      <span className="sr-only">Narration voice</span>
      <svg
        viewBox="0 0 20 20"
        aria-hidden
        className="pointer-events-none absolute left-2.5 size-4 text-zinc-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <path d="M10 3.5v13M6.5 7v6M3 9v2M13.5 7v6M17 9v2" />
      </svg>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as VoiceId)}
        title={disabled ? 'No voice key configured' : 'Narration voice'}
        className="cursor-pointer appearance-none rounded-full border border-black/10 bg-white py-1.5 pl-8 pr-7 text-sm font-medium text-zinc-700 outline-none transition hover:border-black/20 hover:bg-zinc-50 focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {VOICES.map((voice) => (
          <option key={voice.id} value={voice.id}>
            {voice.name}
          </option>
        ))}
      </select>
      {/* Without a visible chevron the select reads as a static label. */}
      <svg
        viewBox="0 0 20 20"
        aria-hidden
        className="pointer-events-none absolute right-2.5 size-3.5 text-zinc-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5 8 5 5 5-5" />
      </svg>
    </label>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-30"
    >
      <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
}

/** Its own component so each generation remounts it and restarts at line one. */
function LoadingLine() {
  const [line, setLine] = useState(0)

  useEffect(() => {
    const timer = setInterval(
      () => setLine((value) => (value + 1) % LOADING_LINES.length),
      4200
    )
    return () => clearInterval(timer)
  }, [])

  return <>{LOADING_LINES[line]}</>
}

function TopicScreen({
  topic,
  setTopic,
  onSubmit,
  script,
  setScript,
  busy,
  pendingTitle,
  error,
  chooser,
}: {
  topic: string
  setTopic: (value: string) => void
  onSubmit: (topic: string, script?: string) => void
  script: string
  setScript: (value: string) => void
  busy: boolean
  pendingTitle: string | null
  error: string | null
  chooser: React.ReactNode
}) {
  const scenes = script.trim() ? parseScript(script).length : 0
  const [saved, setSaved] = useState<SavedScript[]>([])
  const [loading, setLoading] = useState<string | null>(null)

  // The scripts sitting in scripts/. Fetched once, and a failure just means the
  // row of buttons doesn't appear.
  useEffect(() => {
    let live = true
    void fetch('/api/scripts')
      .then((r) => r.json())
      .then((data) => {
        if (live) setSaved(data.scripts ?? [])
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  /** Loads a saved script and sends it straight off to be drawn. */
  async function runSaved(name: string) {
    setLoading(name)
    try {
      const response = await fetch(`/api/scripts?name=${encodeURIComponent(name)}`)
      if (!response.ok) throw new Error(String(response.status))
      const data = (await response.json()) as { text: string }
      setScript(data.text)
      onSubmit(topic, data.text)
    } catch {
      setLoading(null)
    }
  }
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-6 py-16">
      <div className="w-full max-w-2xl">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
          viop
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
          What should I teach you?
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-500">
          Name a topic and I&rsquo;ll work through it at the whiteboard — drawing as I talk,
          the way a good teacher does. Or give me a script you have already written, and I
          will draw the board for it and leave your words alone.
        </p>

        <div className="mt-8">{chooser}</div>

        {/* Scripts already written, ready to draw. */}
        {saved.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">
              Saved scripts
            </p>
            <div className="flex flex-wrap gap-2">
              {saved.map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  disabled={busy}
                  onClick={() => void runSaved(entry.name)}
                  className="group flex items-baseline gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-left shadow-sm transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="text-sm font-medium text-zinc-800">{entry.title}</span>
                  <span className="text-xs text-zinc-400">
                    {loading === entry.name ? 'sending…' : `${entry.scenes} scenes`}
                  </span>
                  {/* Whether the narration is already recorded. A script with
                      its voice on disk starts instantly and costs nothing. */}
                  {loading !== entry.name &&
                    (entry.recorded >= entry.scenes ? (
                      <span
                        title="Narration already recorded"
                        className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
                      >
                        voice ready
                      </span>
                    ) : entry.recorded > 0 ? (
                      <span
                        title="Some scenes still need synthesising"
                        className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                      >
                        voice {entry.recorded}/{entry.scenes}
                      </span>
                    ) : null)}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(topic, script)
          }}
          className="mt-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              disabled={busy}
              autoFocus
              maxLength={500}
              placeholder="How does a transformer pay attention?"
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-[15px] text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || (!topic.trim() && !script.trim())}
              className="shrink-0 rounded-xl bg-zinc-900 px-6 py-3.5 text-[15px] font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Preparing…' : scenes ? `Draw ${scenes} scenes` : 'Teach me'}
            </button>
          </div>

          {/* A script, if there is one. Scene count comes from the script, so a
              fourteen-block script is a fourteen-scene lesson. */}
          <details className="mt-3 group" open={Boolean(script.trim())}>
            <summary className="cursor-pointer select-none text-sm text-zinc-500 transition hover:text-zinc-700">
              {scenes
                ? `Script — ${scenes} scene${scenes === 1 ? '' : 's'}, drawn as written`
                : 'Have a script already? Paste it instead'}
            </summary>
            <textarea
              value={script}
              onChange={(event) => setScript(event.target.value)}
              disabled={busy}
              rows={8}
              placeholder={
                'Paste the whole script. One scene per block — blank lines, headed sections\nor blockquotes all work, and there is no limit on how many.\n\nYour words are copied through exactly; only the drawing is invented.'
              }
              className="mt-2 w-full resize-y rounded-xl border border-zinc-200 bg-white px-4 py-3 font-mono text-[13px] leading-relaxed text-zinc-800 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 disabled:opacity-60"
            />
            {scenes > 0 && (
              <p className="mt-1.5 text-xs text-zinc-500">
                The topic box becomes optional — it only names the lesson.
              </p>
            )}
          </details>
        </form>

        {busy ? (
          <div className="mt-6 flex items-center gap-3 text-sm text-zinc-500">
            <span className="size-2 animate-pulse rounded-full bg-zinc-900" />
            {pendingTitle ? (
              <span>
                <span className="text-zinc-400">Preparing</span>{' '}
                <span className="font-medium text-zinc-700">{pendingTitle}</span>
              </span>
            ) : (
              <LoadingLine />
            )}
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setTopic(suggestion)
                  onSubmit(suggestion)
                }}
                className="rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-[13px] text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
