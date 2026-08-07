'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { estimateNarrationSeconds } from '@/lib/lesson'
import type { ManimLesson } from '@/lib/manim-lesson'
import type { ManimLessonEvent } from '@/lib/manim-stream'
import type { Engine } from '@/lib/engines'
import type { Provider } from '@/lib/providers'
import { DEFAULT_VOICE_ID, VOICES, type VoiceId } from '@/lib/voices'
import type { ManimBoardHandle } from './ManimBoard'
import { Narrator } from '../narrator'
import { RenderBank } from './renders'

const Board = dynamic(() => import('./ManimBoard'), { ssr: false })
const ManimVideoLayer = dynamic(() => import('./ManimVideo'), { ssr: false })

const SUGGESTIONS = [
  'Why is the derivative of sin the cosine?',
  'What does a dot product actually measure?',
  'Why do orbits form ellipses and not circles?',
  'What is a Fourier series really doing?',
]

const LOADING_LINES = [
  'Working out what should move…',
  'Setting up the frame…',
  'Choosing the first thing to draw…',
]

type Phase = 'idle' | 'generating' | 'board'

/** Reads the route's newline-delimited JSON events as they arrive. */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ManimLessonEvent> {
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
        if (line.trim()) yield JSON.parse(line) as ManimLessonEvent
      }
    }
    if (buffer.trim()) yield JSON.parse(buffer) as ManimLessonEvent
  } finally {
    reader.releaseLock()
  }
}

export default function ManimStudio({
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
  const [lesson, setLesson] = useState<ManimLesson | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingTitle, setPendingTitle] = useState<string | null>(null)

  const [sceneIndex, setSceneIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [finished, setFinished] = useState(false)
  const [hasVoice, setHasVoice] = useState(true)
  const [voiceId, setVoiceId] = useState<VoiceId>(DEFAULT_VOICE_ID)
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [followups, setFollowups] = useState<string[]>([])
  const [history, setHistory] = useState<{ title: string; summary: string }[]>([])

  const boardRef = useRef<ManimBoardHandle>(null)
  const [boardReady, setBoardReady] = useState(false)
  /** The rendered scene now showing, or null while the browser renderer drives. */
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const rendersRef = useRef<RenderBank | null>(null)
  const narratorRef = useRef<Narrator | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef(false)

  const lessonRef = useRef<ManimLesson | null>(null)
  const waitingRef = useRef(false)
  const streamingRef = useRef(false)
  const runIdRef = useRef(0)

  useEffect(() => {
    playingRef.current = isPlaying
    // The scene has its own animation loop, so pausing has to stop that too —
    // otherwise the picture keeps animating over silent audio.
    boardRef.current?.setPlaying(isPlaying)
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

  const start = useCallback(
    (next: ManimLesson) => {
      narratorRef.current?.dispose()
      narratorRef.current = new Narrator(voiceId)
      rendersRef.current ??= new RenderBank()
      rendersRef.current.clear()
      setVideoUrl(null)

      lessonRef.current = next
      waitingRef.current = false

      if (next.scenes[0]) narratorRef.current.prefetch(0, next.scenes[0].narration)

      setFollowups([])
      setLesson(next)
      setSceneIndex(0)
      setFinished(false)
      setHasVoice(true)
      setIsPlaying(true)
      setPhase('board')
    },
    [voiceId]
  )

  const addScene = useCallback((event: Extract<ManimLessonEvent, { type: 'scene' }>) => {
    const current = lessonRef.current
    if (!current) return

    const scenes = [...current.scenes, event.scene]
    const next = { ...current, scenes }
    lessonRef.current = next
    setLesson(next)

    if (waitingRef.current) {
      waitingRef.current = false
      setSceneIndex(scenes.length - 1)
    }
  }, [])

  async function generate(nextTopic: string) {
    const trimmed = nextTopic.trim()
    if (!trimmed) return

    const runId = ++runIdRef.current
    const isCurrent = () => runIdRef.current === runId

    setError(null)
    setPendingTitle(null)
    setPhase('generating')

    let started = false
    let pendingMeta: Extract<ManimLessonEvent, { type: 'meta' }> | null = null

    const fail = (message: string) => {
      if (!isCurrent()) return
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
        body: JSON.stringify({ topic: trimmed, history, engine, provider, model }),
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

  // Scene lifecycle: hand the scene to the board on an estimated clock, then
  // correct the timing in place when the real voiceover lands. The board holds
  // the schedule by reference and re-reads it, so steps still waiting pick the
  // corrected moment up rather than firing on the estimate.
  useEffect(() => {
    const board = boardRef.current
    const narrator = narratorRef.current
    if (phase !== 'board' || !narrator) return

    const scene = lessonRef.current?.scenes[sceneIndex]
    if (!scene) return

    let cancelled = false
    let frame = 0
    let audio: HTMLAudioElement | null = null

    let duration = estimateNarrationSeconds(scene.narration)
    const schedule = new Map(scene.steps.map((step) => [step.id, step.at * duration]))

    // Start the browser renderer immediately on an estimate. A rendered video
    // cannot exist before the narration does — its timing is baked in — so
    // waiting for one would leave the screen black for the whole render. The
    // video swaps in when it lands, and from scene two on it is already there.
    setVideoUrl(null)
    board?.setScene(scene, schedule)
    board?.setPlaying(playingRef.current)

    void narrator.get(sceneIndex, scene.narration).then(async (narration) => {
      if (cancelled) return

      audio = narration.audio
      audioRef.current = audio
      duration = narration.duration
      setHasVoice(narrator.hasVoice)

      // Mutated in place, not replaced: the board is holding this exact map.
      for (const step of scene.steps) {
        const anchored = step.anchor ? narration.timeOf(step.anchor) : null
        schedule.set(step.id, anchored ?? step.at * narration.duration)
      }

      const next = lessonRef.current?.scenes[sceneIndex + 1]
      if (next) narrator.prefetch(sceneIndex + 1, next.narration)

      if (audio) {
        audio.currentTime = 0
        if (playingRef.current) void audio.play().catch(() => setIsPlaying(false))
      }

      const renders = rendersRef.current
      if (!renders || !(await renders.canRender()) || cancelled) return

      setRendering(true)
      const url = await renders.get(sceneIndex, scene, narration)
      if (cancelled) return
      setRendering(false)

      if (url) {
        // The video owns the picture from here; two renderers drawing the same
        // scene at once would just fight.
        board?.setPlaying(false)
        setVideoUrl(url)
      }

      // Render the next scene while this one plays. Its narration has to exist
      // first, which is why this waits on the prefetch rather than firing now.
      if (next && !cancelled) {
        void narrator
          .get(sceneIndex + 1, next.narration)
          .then((ahead) => {
            if (!cancelled) void renders.get(sceneIndex + 1, next, ahead)
          })
          .catch(() => {})
      }
    })

    let elapsed = 0
    let last = performance.now()
    let advanced = false

    const tick = (now: number) => {
      if (cancelled) return

      const delta = (now - last) / 1000
      last = now
      if (playingRef.current) elapsed += delta

      const seconds = audio ? audio.currentTime : elapsed
      board?.setTime(seconds)

      const fraction = Math.min(1, seconds / Math.max(0.1, duration))
      const ended = audio ? audio.ended || fraction >= 1 : fraction >= 1

      if (ended && !advanced) {
        advanced = true
        const total = lessonRef.current?.scenes.length ?? 0

        if (sceneIndex + 1 < total) setSceneIndex(sceneIndex + 1)
        else if (streamingRef.current) waitingRef.current = true
        else {
          setIsPlaying(false)
          setFinished(true)
        }
        return
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      setRendering(false)
      audio?.pause()
      if (audioRef.current === audio) audioRef.current = null
    }
  }, [phase, sceneIndex, sceneId, boardReady])

  /** The voice's clock, for the video to follow. */
  const audioTime = useCallback(() => audioRef.current?.currentTime ?? 0, [])

  const goToScene = useCallback((index: number) => {
    if (!lessonRef.current) return
    const target = Math.max(0, Math.min(lessonRef.current.scenes.length - 1, index))
    waitingRef.current = false
    setFinished(false)
    setSceneIndex(target)
  }, [])

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
    // Black, because manim renders on black and a light frame around it would
    // look like a mistake.
    <div className="fixed inset-0 bg-black">
      {/* The board keeps drawing underneath: it is what shows while the first
          scene renders, and what carries the whole lesson if the server has no
          manim. The video covers it once one arrives. */}
      <Board ref={boardRef} onReady={onBoardReady} />
      {videoUrl && (
        <ManimVideoLayer src={videoUrl} playing={isPlaying} audioTime={audioTime} />
      )}

      {rendering && (
        <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-full border border-white/15 bg-zinc-900/80 px-3.5 py-1.5 text-xs text-zinc-300 backdrop-blur">
          Rendering this scene…
        </div>
      )}

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-end p-4">
        <button
          type="button"
          onClick={newLesson}
          className="pointer-events-auto rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm font-medium text-zinc-200 backdrop-blur transition hover:bg-white/20 hover:text-white"
        >
          New topic
        </button>
      </header>

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
                className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-zinc-200 backdrop-blur transition hover:border-white/30 hover:text-white"
              >
                {next}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-5">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-zinc-900/80 px-3 py-2 shadow-lg shadow-black/40 backdrop-blur">
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
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-zinc-900 transition hover:bg-zinc-200"
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

          <span className="mx-1 h-6 w-px bg-white/15" />

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
              className="w-52 rounded-full bg-white/10 px-4 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:bg-white/15 focus:ring-2 focus:ring-white/20 disabled:animate-pulse"
            />
          </form>

          <span className="mx-1 h-6 w-px bg-white/15" />

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
        className="pointer-events-none absolute left-2.5 size-4 text-zinc-400"
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
        className="cursor-pointer appearance-none rounded-full border border-white/15 bg-white/10 py-1.5 pl-8 pr-7 text-sm font-medium text-zinc-200 outline-none transition hover:border-white/30 focus:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {VOICES.map((voice) => (
          <option key={voice.id} value={voice.id} className="text-zinc-900">
            {voice.name}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 20 20"
        aria-hidden
        className="pointer-events-none absolute right-2.5 size-3.5 text-zinc-500"
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
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
    >
      <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
}

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
          Name something in maths or physics and I&rsquo;ll animate it — the way a good
          explainer moves the picture while it talks.
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
              placeholder="Why is e^(iπ) = −1?"
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
