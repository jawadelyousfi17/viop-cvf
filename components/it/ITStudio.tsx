'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from 'tldraw'
import { estimateNarrationSeconds, type ITLesson } from '@/lib/it-lesson'
import type { ITLessonEvent } from '@/lib/it-stream'
import type { Engine } from '@/lib/engines'
import type { Provider } from '@/lib/providers'
import { DEFAULT_VOICE_ID, VOICES, type VoiceId } from '@/lib/voices'
import type { ITPainter } from './paint'
import { Narrator } from '../narrator'

const ITBoard = dynamic(() => import('./board'), { ssr: false })

const SUGGESTIONS = [
  'Why is the stack faster than the heap?',
  'What actually happens on a cache miss?',
  'How does a context switch work?',
  'Why is a linked list slow on modern hardware?',
]

const LOADING_LINES = [
  'Reading up on your topic…',
  'Working out the diagram…',
  'Deciding what to build first…',
]

type Phase = 'idle' | 'generating' | 'board'

/** Reads the route's newline-delimited JSON events as they arrive. */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ITLessonEvent> {
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
        if (line.trim()) yield JSON.parse(line) as ITLessonEvent
      }
    }
    if (buffer.trim()) yield JSON.parse(buffer) as ITLessonEvent
  } finally {
    reader.releaseLock()
  }
}

/**
 * The player for the IT engine.
 *
 * Structurally the same as the whiteboard's, and deliberately simpler in two
 * places: there are no image lookups and no chart rasterising, because this
 * style draws everything it shows. Nothing is fetched mid-scene, so an element
 * is never late for the words that introduce it.
 */
export default function ITStudio({
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
  const [lesson, setLesson] = useState<ITLesson | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingTitle, setPendingTitle] = useState<string | null>(null)

  const [sceneIndex, setSceneIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [finished, setFinished] = useState(false)
  const [hasVoice, setHasVoice] = useState(true)
  const [voiceId, setVoiceId] = useState<VoiceId>(DEFAULT_VOICE_ID)
  const [followups, setFollowups] = useState<string[]>([])
  const [history, setHistory] = useState<{ title: string; summary: string }[]>([])

  const painterRef = useRef<ITPainter | null>(null)
  const narratorRef = useRef<Narrator | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef(false)
  const [painterReady, setPainterReady] = useState(false)

  const lessonRef = useRef<ITLesson | null>(null)
  const waitingRef = useRef(false)
  const streamingRef = useRef(false)
  /** Bumped per lesson so a stale stream can't write into a newer one. */
  const runIdRef = useRef(0)

  useEffect(() => {
    playingRef.current = isPlaying
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) void audio.play().catch(() => setIsPlaying(false))
    else audio.pause()
  }, [isPlaying, sceneIndex])

  // Must stay synchronous: tldraw treats whatever `onMount` returns as an
  // unmount cleanup, so returning a promise crashes the editor.
  const onEditor = useCallback((editor: Editor) => {
    void import('./paint').then(({ ITPainter }) => {
      painterRef.current = new ITPainter(editor)
      setPainterReady(true)
    })
  }, [])

  useEffect(() => {
    return () => {
      narratorRef.current?.dispose()
      audioRef.current?.pause()
    }
  }, [])

  const start = useCallback(
    (next: ITLesson) => {
      narratorRef.current?.dispose()
      narratorRef.current = new Narrator(voiceId)
      painterRef.current?.reset()

      lessonRef.current = next
      waitingRef.current = false

      // Overlaps the first voiceover with tldraw mounting, which is otherwise
      // several seconds of dead time.
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

  const addScene = useCallback((event: Extract<ITLessonEvent, { type: 'scene' }>) => {
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
    let pendingMeta: Extract<ITLessonEvent, { type: 'meta' }> | null = null

    const fail = (message: string) => {
      if (!isCurrent()) return
      // Once the board is up, a late failure just ends the lesson early —
      // whatever streamed in stays playable.
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
          body: JSON.stringify({
            lesson: {
              title: finishedLesson.title,
              summary: finishedLesson.summary,
              scenes: finishedLesson.scenes.map((scene) => ({ narration: scene.narration })),
            },
          }),
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

  // Scene lifecycle: frame the board, start the narration, and reveal elements
  // as the voice reaches them. Keyed off the scene's id rather than the lesson,
  // so a newly streamed scene never interrupts the one playing.
  useEffect(() => {
    const painter = painterRef.current
    const narrator = narratorRef.current
    if (phase !== 'board' || !painter || !narrator) return

    const scene = lessonRef.current?.scenes[sceneIndex]
    if (!scene) return

    let cancelled = false
    let frame = 0
    let audio: HTMLAudioElement | null = null

    painter.focus(sceneIndex)

    // Anything due at the first word is drawn before the audio resolves, so
    // the board isn't blank for as long as the voice takes to fetch.
    for (const element of scene.elements.filter((e) => e.at <= 0.001 && !e.anchor)) {
      painter.paint(sceneIndex, element, scene.elements)
    }

    let duration = estimateNarrationSeconds(scene.narration)
    let schedule = scene.elements.map((element) => ({
      element,
      time: element.at * duration,
    }))

    void narrator.get(sceneIndex, scene.narration).then((narration) => {
      if (cancelled) return

      audio = narration.audio
      audioRef.current = audio
      duration = narration.duration
      setHasVoice(narrator.hasVoice)

      // Re-time against the real clip: anchored elements now land on their words.
      schedule = scene.elements.map((element) => {
        const anchored = element.anchor ? narration.timeOf(element.anchor) : null
        return { element, time: anchored ?? element.at * narration.duration }
      })

      const next = lessonRef.current?.scenes[sceneIndex + 1]
      if (next) narrator.prefetch(sceneIndex + 1, next.narration)

      if (audio) {
        audio.currentTime = 0
        if (playingRef.current) void audio.play().catch(() => setIsPlaying(false))
      }
    })

    let advanced = false
    let elapsed = 0
    let last = performance.now()

    const tick = (now: number) => {
      if (cancelled) return

      const delta = (now - last) / 1000
      last = now
      if (playingRef.current) elapsed += delta

      const seconds = audio ? audio.currentTime : elapsed
      const fraction = Math.min(1, seconds / Math.max(0.1, duration))

      for (const entry of schedule) {
        if (entry.time <= seconds) painter.paint(sceneIndex, entry.element, scene.elements)
      }

      const ended = audio ? audio.ended || fraction >= 1 : fraction >= 1
      if (ended && !advanced) {
        advanced = true
        const total = lessonRef.current?.scenes.length ?? 0

        if (sceneIndex + 1 < total) {
          setSceneIndex(sceneIndex + 1)
        } else if (streamingRef.current) {
          // Playback has outrun the model. Hold; `addScene` resumes us.
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

      // Skipping forward shouldn't leave holes: fill in every earlier scene at
      // once, without the fade choreography.
      for (let i = 0; i < target; i++) {
        for (const element of lesson.scenes[i].elements) {
          painter.paint(i, element, lesson.scenes[i].elements, false)
        }
      }

      waitingRef.current = false
      setFinished(false)
      setSceneIndex(target)
    },
    [lesson]
  )

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
        busy={phase === 'generating'}
        pendingTitle={pendingTitle}
        error={error}
        chooser={chooser}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black">
      <ITBoard onEditor={onEditor} />

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
        className="cursor-pointer appearance-none rounded-full border border-white/15 bg-white/10 py-1.5 pl-8 pr-7 text-sm font-medium text-zinc-200 outline-none transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-40"
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
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
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
    const timer = setInterval(() => setLine((value) => (value + 1) % LOADING_LINES.length), 4200)
    return () => clearInterval(timer)
  }, [])

  return <>{LOADING_LINES[line]}</>
}

/** Dark, like the board it leads into — the engine announces itself here. */
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
    <main className="flex min-h-dvh flex-col items-center justify-center bg-black px-6 py-16">
      <div className="w-full max-w-2xl">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          viop · IT explain
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          What should I explain?
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-400">
          Name something about how computers work and I&rsquo;ll build the diagram for it,
          piece by piece, while I talk you through it.
        </p>

        <div className="mt-8 [&_.bg-zinc-100]:bg-white/10 [&_.text-zinc-400]:text-zinc-500 [&_.text-zinc-500]:text-zinc-400">
          {chooser}
        </div>

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
              placeholder="Why is the stack so fast?"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-[15px] text-white outline-none transition placeholder:text-zinc-500 focus:border-white/30 focus:ring-4 focus:ring-white/5 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || !topic.trim()}
              className="shrink-0 rounded-xl bg-white px-6 py-3.5 text-[15px] font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Preparing…' : 'Explain it'}
            </button>
          </div>
        </form>

        {busy ? (
          <div className="mt-6 flex items-center gap-3 text-sm text-zinc-400">
            <span className="size-2 animate-pulse rounded-full bg-white" />
            {pendingTitle ? (
              <span>
                <span className="text-zinc-500">Preparing</span>{' '}
                <span className="font-medium text-zinc-200">{pendingTitle}</span>
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
                className="rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-[13px] text-zinc-300 transition hover:border-white/30 hover:text-white"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
