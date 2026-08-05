'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { estimateNarrationSeconds, type Lesson } from '@/lib/lesson'
import type { LessonEvent } from '@/lib/lesson-stream'
import type { Engine } from '@/lib/engines'
import type { Provider } from '@/lib/providers'
import { DEFAULT_VOICE_ID, VOICES, type VoiceId } from '@/lib/voices'
import { ImageBank } from '../images'
import type { BoardHandle } from './CanvasBoard'
import { Narrator } from '../narrator'

// tldraw is browser-only and heavy — keep it out of the server bundle and off
// the critical path for the topic screen.
const Board = dynamic(() => import('./CanvasBoard'), { ssr: false })

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

/** Every image query in a scene, for prefetching. */
function imageQueries(scene: { shapes: { kind: string; text: string }[] }) {
  return scene.shapes.filter((s) => s.kind === 'image' && s.text.trim()).map((s) => s.text)
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

export default function CanvasStudio({
  engine,
  provider,
  chooser,
}: {
  engine: Engine
  provider: Provider
  chooser: React.ReactNode
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [topic, setTopic] = useState('')
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

  const boardRef = useRef<BoardHandle>(null)
  const [boardReady, setBoardReady] = useState(false)
  const narratorRef = useRef<Narrator | null>(null)
  const imagesRef = useRef<ImageBank | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef(false)

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

  useEffect(() => {
    return () => {
      narratorRef.current?.dispose()
      audioRef.current?.pause()
    }
  }, [])

  const onBoardReady = useCallback(() => setBoardReady(true), [])

  const start = useCallback((next: Lesson) => {
    narratorRef.current?.dispose()
    narratorRef.current = new Narrator(voiceId)
    imagesRef.current = new ImageBank()

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

  async function generate(nextTopic: string) {
    const trimmed = nextTopic.trim()
    if (!trimmed) return

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
        body: JSON.stringify({ topic: trimmed, history, engine, provider }),
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
              title: pendingMeta?.title || trimmed,
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
    const board = boardRef.current
    const narrator = narratorRef.current
    if (phase !== 'board' || !board || !narrator) return

    const scene = lessonRef.current?.scenes[sceneIndex]
    if (!scene) return

    let cancelled = false
    let frame = 0
    let audio: HTMLAudioElement | null = null

    // Open tight on whatever leads the scene, then let maybeReframe pull back
    // as the board fills. Framing everything up front gives a static wide shot.
    // Open on the whole scene now that content is centred in the board, then
    // let maybeReframe follow the work as it fills in.
    board.setScene(scene, sceneIndex)

    // Image lookups run in parallel with the voiceover, so a picture is
    // usually decoded before the narration reaches it.
    const bank = imagesRef.current
    if (bank) {
      for (const shape of scene.shapes) {
        if (shape.kind !== 'image' || !shape.text.trim()) continue
        void bank.get(shape.text).then((found) => {
          if (cancelled || !found) return
          // Decode before handing it over: drawImage on an undecoded element
          // paints nothing, and the canvas has no retry the way an <img> does.
          const element = new Image()
          element.crossOrigin = 'anonymous'
          element.onload = () => board.addImage(shape.text, element)
          element.src = found.src
        })
      }
    }


    // Drawing starts immediately on an estimated clock rather than waiting for
    // the voiceover. TTS takes several seconds — longer when six scenes' worth
    // of audio and images are in flight — and gating the board on it left the
    // canvas showing a single shape until the audio landed.
    let duration = estimateNarrationSeconds(scene.narration)
    let schedule = new Map(scene.shapes.map((shape) => [shape.id, shape.at * duration]))

    void narrator.get(sceneIndex, scene.narration).then((narration) => {
      if (cancelled) return

      audio = narration.audio
      audioRef.current = audio
      duration = narration.duration
      setHasVoice(narrator.hasVoice)

      // Re-time against the real clip: anchored shapes now land on their words.
      schedule = new Map(
        scene.shapes.map((shape) => {
          const anchored = shape.anchor ? narration.timeOf(shape.anchor) : null
          return [shape.id, anchored ?? shape.at * narration.duration]
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

        board.setTime(seconds, schedule)

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
  }, [phase, sceneIndex, sceneId, boardReady])

  const goToScene = useCallback((index: number) => {
    if (!lessonRef.current) return
    const target = Math.max(0, Math.min(lessonRef.current.scenes.length - 1, index))
    waitingRef.current = false
    setFinished(false)
    setSceneIndex(target)
  }, [])

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
    narratorRef.current?.dispose()
    narratorRef.current = null
  }

  if (phase !== 'board') {
    return (
      <TopicScreen
        topic={topic}
        setTopic={setTopic}
        onSubmit={generate}
        busy={phase === 'generating'}
        pendingTitle={pendingTitle}
        error={error}
        chooser={chooser}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-[#f7f8fa]">
      <Board ref={boardRef} onReady={onBoardReady} />

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
  busy,
  pendingTitle,
  error,
  chooser,
}: {
  topic: string
  setTopic: (value: string) => void
  onSubmit: (topic: string) => void
  busy: boolean
  pendingTitle: string | null
  error: string | null
  chooser: React.ReactNode
}) {
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
          the way a good teacher does.
        </p>

        <div className="mt-8">{chooser}</div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(topic)
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
              disabled={busy || !topic.trim()}
              className="shrink-0 rounded-xl bg-zinc-900 px-6 py-3.5 text-[15px] font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Preparing…' : 'Teach me'}
            </button>
          </div>
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
