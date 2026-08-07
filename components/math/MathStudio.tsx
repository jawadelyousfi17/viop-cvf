'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Engine } from '@/lib/engines'
import type { Provider } from '@/lib/providers'
import { DEFAULT_VOICE_ID, type VoiceId } from '@/lib/voices'
import { Narrator } from '../narrator'
import type { SavedScript } from '@/app/api/scripts/route'
import type { MathLesson, MathScene } from '@/lib/math-lesson'
import type { MathLessonEvent } from '@/lib/math-stream'
import type { NotebookHandle } from './Notebook'

// WebGL, LaTeX and three.js: none of it belongs in the bundle until a page is
// actually being worked through.
const Notebook = dynamic(() => import('./Notebook'), { ssr: false })

type Phase = 'idle' | 'working' | 'page'

/** Roughly how long narration takes to say, for timing before the audio lands. */
const WORDS_PER_SECOND = 2.6

function estimateSeconds(narration: string) {
  const words = narration.trim().split(/\s+/).filter(Boolean).length
  return Math.max(4, words / WORDS_PER_SECOND)
}

/** Reads the route's newline-delimited events as they arrive. */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<MathLessonEvent> {
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
      for (const line of lines) if (line.trim()) yield JSON.parse(line) as MathLessonEvent
    }
    if (buffer.trim()) yield JSON.parse(buffer) as MathLessonEvent
  } finally {
    reader.releaseLock()
  }
}

/**
 * The notebook player.
 *
 * Full screen and nothing else on it: a page of working is the whole point, and
 * a panel down one side would be repeating in text what the page already says.
 * The transport lives over the paper and fades out of the way.
 */
export default function MathStudio({
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
  const [problem, setProblem] = useState('')
  const [lesson, setLesson] = useState<MathLesson | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [finished, setFinished] = useState(false)
  const [atEdge, setAtEdge] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [plan, setPlan] = useState<{ total: number; next: number } | null>(null)
  const [saved, setSaved] = useState<SavedScript[]>([])
  const [voiceId] = useState<VoiceId>(DEFAULT_VOICE_ID)

  const notebookRef = useRef<NotebookHandle>(null)
  const narratorRef = useRef<Narrator | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lessonRef = useRef<MathLesson | null>(null)
  const playingRef = useRef(false)
  const waitingRef = useRef(false)
  const streamingRef = useRef(false)
  const planRef = useRef<{ script: string; total: number; next: number } | null>(null)
  const drawingRef = useRef(false)
  const runIdRef = useRef(0)
  const [ready, setReady] = useState(false)

  const onReady = useCallback(() => setReady(true), [])

  useEffect(() => {
    playingRef.current = isPlaying
    notebookRef.current?.setPlaying(isPlaying)
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) void audio.play().catch(() => setIsPlaying(false))
    else audio.pause()
  }, [isPlaying, pageIndex])

  useEffect(() => {
    void fetch('/api/scripts')
      .then((r) => r.json())
      .then((data) => setSaved(data.scripts ?? []))
      .catch(() => {})
    return () => {
      narratorRef.current?.dispose()
      audioRef.current?.pause()
    }
  }, [])

  const start = useCallback(
    (next: MathLesson) => {
      narratorRef.current?.dispose()
      narratorRef.current = new Narrator(voiceId)
      lessonRef.current = next
      waitingRef.current = false

      if (next.scenes[0]) narratorRef.current.prefetch(0, next.scenes[0].narration)

      setLesson(next)
      setPageIndex(0)
      setFinished(false)
      setAtEdge(false)
      setIsPlaying(true)
      setPhase('page')
    },
    [voiceId]
  )

  const addPage = useCallback((scene: MathScene) => {
    const current = lessonRef.current
    if (!current) return
    const scenes = [...current.scenes, scene]
    const next = { ...current, scenes }
    lessonRef.current = next
    setLesson(next)

    if (waitingRef.current) {
      waitingRef.current = false
      setPageIndex(scenes.length - 1)
    }
  }, [])

  /** Writes the next page of a script that is being worked through on demand. */
  const writeNext = useCallback(async () => {
    const pending = planRef.current
    if (!pending || drawingRef.current || pending.next >= pending.total) return false

    drawingRef.current = true
    setDrawing(true)
    setError(null)
    const runId = runIdRef.current

    try {
      const response = await fetch('/api/lesson', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          script: pending.script,
          from: pending.next,
          count: 1,
          engine,
          provider,
          model,
        }),
      })
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? `Request failed (${response.status})`)
      }

      for await (const event of readEvents(response.body)) {
        if (runIdRef.current !== runId) return false
        if (event.type === 'scene') {
          const drawn = { ...pending, next: pending.next + 1 }
          planRef.current = drawn
          setPlan({ total: drawn.total, next: drawn.next })
          addPage(event.scene)
        } else if (event.type === 'error') {
          throw new Error(event.message)
        }
      }
      return true
    } catch (cause) {
      if (runIdRef.current !== runId) return false
      waitingRef.current = false
      setIsPlaying(false)
      setError(cause instanceof Error ? cause.message : 'Could not write the next page.')
      return false
    } finally {
      drawingRef.current = false
      setDrawing(false)
    }
  }, [addPage, engine, provider, model])

  const carryOn = useCallback(async () => {
    setAtEdge(false)
    waitingRef.current = true
    if (await writeNext()) setIsPlaying(true)
    else waitingRef.current = false
  }, [writeNext])

  async function work(topic: string, script?: string) {
    const asked = topic.trim()
    const scripted = script?.trim() ?? ''
    if (!asked && !scripted) return

    const runId = ++runIdRef.current
    const isCurrent = () => runIdRef.current === runId

    setError(null)
    setPhase('working')
    planRef.current = null
    setPlan(null)

    const onDemand = scripted.length > 0
    let started = false
    let title = asked || 'Worked through'
    let summary = ''

    try {
      const response = await fetch('/api/lesson', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: asked,
          script: scripted,
          engine,
          provider,
          model,
          ...(onDemand ? { from: 0, count: 1 } : {}),
        }),
      })
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? `Request failed (${response.status})`)
      }
      streamingRef.current = true

      for await (const event of readEvents(response.body)) {
        if (!isCurrent()) return

        if (event.type === 'plan') {
          if (onDemand) {
            planRef.current = { script: scripted, total: event.total, next: 0 }
            setPlan({ total: event.total, next: 0 })
          }
        } else if (event.type === 'meta') {
          title = event.title || title
          summary = event.summary || summary
          if (started) setLesson((prev) => (prev ? { ...prev, title, summary } : prev))
        } else if (event.type === 'scene') {
          if (planRef.current) {
            const drawn = { ...planRef.current, next: planRef.current.next + 1 }
            planRef.current = drawn
            setPlan({ total: drawn.total, next: drawn.next })
          }
          if (!started) {
            started = true
            start({ title, summary, scenes: [event.scene] })
          } else {
            addPage(event.scene)
          }
        } else if (event.type === 'error') {
          throw new Error(event.message)
        }
      }

      if (!isCurrent()) return
      if (!started) throw new Error('Nothing came back.')
      streamingRef.current = false
    } catch (cause) {
      streamingRef.current = false
      if (!isCurrent()) return
      setError(cause instanceof Error ? cause.message : 'Something went wrong.')
      if (!started) setPhase('idle')
    }
  }

  const page = lesson?.scenes[pageIndex]
  const pageId = page?.id
  const hasMore = Boolean(plan && plan.next < plan.total)

  // The page's life: hand it to the notebook, start the voice, and feed the
  // clock. Keyed on the page's id rather than the lesson, so a page arriving
  // mid-stream never interrupts the one being worked through.
  useEffect(() => {
    const notebook = notebookRef.current
    const narrator = narratorRef.current
    if (phase !== 'page' || !page || !notebook || !narrator || !ready) return

    let cancelled = false
    let frame = 0
    let audio: HTMLAudioElement | null = null

    // Held by reference: the notebook re-reads it as the page plays, so the
    // real timing can replace the estimate underneath a line already waiting.
    const schedule = new Map<string, number>()
    let duration = estimateSeconds(page.narration)
    for (const step of page.steps) schedule.set(step.id, step.at * duration)

    notebook.setScene(page, schedule)
    notebook.setPlaying(playingRef.current)

    void narrator.get(pageIndex, page.narration).then((narration) => {
      if (cancelled) return

      audio = narration.audio
      audioRef.current = audio
      duration = narration.duration

      // Re-timed against the real clip: anchored lines now land on their words.
      for (const step of page.steps) {
        const at = step.anchor ? narration.timeOf(step.anchor) : null
        schedule.set(step.id, at ?? step.at * narration.duration)
      }

      const next = lessonRef.current?.scenes[pageIndex + 1]
      if (next) narrator.prefetch(pageIndex + 1, next.narration)

      if (audio) {
        audio.currentTime = 0
        if (playingRef.current) void audio.play().catch(() => setIsPlaying(false))
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
      notebook.setTime(seconds)

      const ended = audio ? audio.ended || seconds >= duration : elapsed >= duration
      if (ended && !advanced) {
        advanced = true
        const total = lessonRef.current?.scenes.length ?? 0

        if (pageIndex + 1 < total) setPageIndex(pageIndex + 1)
        else if (streamingRef.current) waitingRef.current = true
        else if (planRef.current && planRef.current.next < planRef.current.total) {
          setIsPlaying(false)
          setAtEdge(true)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pageIndex, pageId, ready])

  const goToPage = useCallback(
    (index: number) => {
      if (!lesson) return
      if (index >= lesson.scenes.length) {
        void carryOn()
        return
      }
      waitingRef.current = false
      setFinished(false)
      setAtEdge(false)
      setPageIndex(Math.max(0, Math.min(lesson.scenes.length - 1, index)))
    },
    [lesson, carryOn]
  )

  if (phase !== 'page') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-6 py-16">
        <div className="w-full max-w-2xl">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
            viop
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            What should I work through?
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-500">
            Give me something to solve and I&rsquo;ll do it on paper, a line at a time, saying
            why each line follows from the one above it.
          </p>

          <div className="mt-8">{chooser}</div>

          {saved.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                Written scripts
              </p>
              <div className="flex flex-wrap gap-2">
                {saved.map((entry) => (
                  <button
                    key={entry.name}
                    type="button"
                    disabled={phase === 'working'}
                    onClick={() =>
                      void fetch(`/api/scripts?name=${encodeURIComponent(entry.name)}`)
                        .then((r) => r.json())
                        .then((data: { text: string }) => work('', data.text))
                        .catch(() => setError('Could not load that script.'))
                    }
                    className="flex items-baseline gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 shadow-sm transition hover:border-zinc-400 disabled:opacity-50"
                  >
                    <span className="text-sm font-medium text-zinc-800">{entry.title}</span>
                    <span className="text-xs text-zinc-400">{entry.scenes} pages</span>
                    {entry.recorded >= entry.scenes && (
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        voice ready
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault()
              void work(problem)
            }}
            className="mt-6 flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={problem}
              onChange={(event) => setProblem(event.target.value)}
              disabled={phase === 'working'}
              autoFocus
              maxLength={500}
              placeholder="Solve 2x² + 5x − 3 = 0"
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-[15px] text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={phase === 'working' || !problem.trim()}
              className="shrink-0 rounded-xl bg-zinc-900 px-6 py-3.5 text-[15px] font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
            >
              {phase === 'working' ? 'Working…' : 'Work it through'}
            </button>
          </form>

          {error && (
            <p className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#faf7f0]">
      <Notebook ref={notebookRef} onReady={onReady} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-5">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-black/10 bg-white/90 px-3 py-2 shadow-lg shadow-black/5 backdrop-blur">
          <button
            type="button"
            onClick={() => goToPage(pageIndex - 1)}
            disabled={pageIndex === 0}
            aria-label="Previous page"
            className="flex size-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-black/5 hover:text-zinc-900 disabled:opacity-30"
          >
            <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M14 5 8 10l6 5V5Z" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() =>
              finished
                ? (setFinished(false), setPageIndex(0), setIsPlaying(true))
                : atEdge
                  ? void carryOn()
                  : setIsPlaying((value) => !value)
            }
            aria-label={finished ? 'Start again' : atEdge ? 'Write the next page' : isPlaying ? 'Pause' : 'Play'}
            className="flex size-11 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-700"
          >
            {isPlaying && !atEdge ? (
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

          <button
            type="button"
            onClick={() => goToPage(pageIndex + 1)}
            disabled={drawing || (pageIndex >= (lesson?.scenes.length ?? 1) - 1 && !hasMore)}
            aria-label={hasMore ? 'Write the next page' : 'Next page'}
            className="flex size-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-black/5 hover:text-zinc-900 disabled:opacity-30"
          >
            <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M6 5l6 5-6 5V5Z" />
            </svg>
          </button>

          <span className="mx-1 h-6 w-px bg-black/10" />
          <span className="whitespace-nowrap px-1 text-xs tabular-nums text-zinc-400">
            {drawing
              ? `writing ${(plan?.next ?? 0) + 1}…`
              : plan
                ? `page ${pageIndex + 1} of ${plan.total}`
                : `page ${pageIndex + 1} of ${lesson?.scenes.length ?? 1}`}
          </span>

          {error && (
            <span className="max-w-[16rem] truncate text-xs text-red-600" title={error}>
              {error}
            </span>
          )}
        </div>
      </div>
    </main>
  )
}
