'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Engine } from '@/lib/engines'
import type { Provider } from '@/lib/providers'
import { DEFAULT_VOICE_ID, type VoiceId } from '@/lib/voices'
import { Narrator } from '../narrator'
import { parseLesson, parseScript, type SlateLesson } from '@/lib/slate'
import { lint } from '@/lib/slate-lint'
import { drawScene, showBeat } from './draw'
import './slate.css'

/**
 * A beat, once it has a place on the clock.
 *
 * Beats are sentences, which is the whole reason this engine can be timed
 * properly: a sentence is a thing the voice provider can find in its own
 * alignment. Chalk had to guess where a phrase fell; here the first words of
 * each sentence are looked up in the recording and the beat starts exactly
 * there.
 */
interface Cue {
  scene: number
  beat: number
  text: string
  start: number
}

const WORDS_PER_SECOND = 2.6

/** Enough of a sentence to be unambiguous, short enough to be found. */
const opening = (sentence: string) => sentence.split(/\s+/).slice(0, 7).join(' ')

export default function SlateStudio({
  provider,
  model,
  chooser,
}: {
  engine: Engine
  provider: Provider
  model: string
  chooser: React.ReactNode
}) {
  const [source, setSource] = useState('')
  const [script, setScript] = useState('')
  const [sceneIndex, setSceneIndex] = useState(0)
  const [beat, setBeat] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showChecks, setShowChecks] = useState(false)
  const [showDesk, setShowDesk] = useState(true)

  // Reparsed as it is typed. The whole language is a few hundred lines of
  // string handling, so this is cheaper than the render it feeds — and a
  // language whose errors arrive a second late is one you argue with.
  const lesson = useMemo<SlateLesson | null>(
    () => (source.trim() ? parseLesson(source, parseScript(script)) : null),
    [source, script]
  )
  const problems = useMemo(() => (lesson ? lint(lesson) : []), [lesson])
  const ready = Boolean(lesson)

  const boardRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const narratorRef = useRef<Narrator | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef(false)
  const registryRef = useRef<Record<string, HTMLElement>>({})
  const cuesRef = useRef<Cue[]>([])
  const lessonRef = useRef<SlateLesson | null>(null)

  const errors = problems.filter((p) => p.level === 'err')

  // The examples ship with the engine: something has to be on screen before
  // anyone has written a line, or the first impression is an empty box.
  useEffect(() => {
    let live = true
    void Promise.all([
      fetch('/api/slate?name=dns.slate').then((r) => r.text()),
      fetch('/api/slate?name=dns.script.md').then((r) => r.text()),
    ])
      .then(([board, words]) => {
        if (!live) return
        setSource(board)
        setScript(words)
      })
      .catch(() => {})
    return () => {
      live = false
      narratorRef.current?.dispose()
      audioRef.current?.pause()
    }
  }, [])

  // The animation loop reads the lesson through a ref, so a keystroke in the
  // source does not restart the scene being played.
  useEffect(() => {
    lessonRef.current = lesson
  }, [lesson])

  useEffect(() => {
    playingRef.current = isPlaying
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) void audio.play().catch(() => setIsPlaying(false))
    else audio.pause()
  }, [isPlaying])

  const scene = lesson?.scenes[sceneIndex]

  // Draw the scene, then let the beats reveal it. Every shape is in the
  // document from the start and invisible; a beat only toggles a class.
  useEffect(() => {
    const board = boardRef.current
    if (!board || !scene || !lesson) return

    // Every scene is drawn once in order first, so a `carry` in scene nine can
    // find a shape that scene seven defined without having played it.
    const registry: Record<string, HTMLElement> = {}
    for (const past of lesson.scenes) {
      const { byName } = drawScene(lesson, past, registry)
      Object.assign(registry, byName)
    }
    registryRef.current = registry

    const { fragment, byName } = drawScene(lesson, scene, registry)
    board.textContent = ''
    board.appendChild(fragment)
    Object.assign(registryRef.current, byName)
    showBeat(board, 0)
    setBeat(0)
  }, [lesson, scene])

  // The voice, and the clock it puts the beats on.
  useEffect(() => {
    if (!scene || !ready) return

    narratorRef.current ??= new Narrator(DEFAULT_VOICE_ID as VoiceId)
    const narrator = narratorRef.current
    const narration = scene.beats.join(' ')
    if (!narration.trim()) return

    let cancelled = false
    let frame = 0
    let audio: HTMLAudioElement | null = null

    // Estimated first, so the board moves before the audio has landed.
    let clock = 0
    let cues: Cue[] = []
    let at = 0
    for (const [i, sentence] of scene.beats.entries()) {
      const words = sentence.split(/\s+/).filter(Boolean).length
      cues.push({ scene: scene.n, beat: i + 1, text: sentence, start: at })
      at += Math.max(1.4, words / WORDS_PER_SECOND + 0.35)
    }
    cuesRef.current = cues
    let duration = at

    void narrator.get(sceneIndex, narration).then((spoken) => {
      if (cancelled) return
      audio = spoken.audio
      audioRef.current = audio
      duration = spoken.duration

      // Re-timed against the recording: each sentence starts where it is
      // actually said. A sentence the aligner cannot find keeps its estimate.
      cues = cues.map((cue) => ({ ...cue, start: spoken.timeOf(opening(cue.text)) ?? cue.start }))
      for (let i = 1; i < cues.length; i++) {
        if (cues[i].start < cues[i - 1].start) cues[i].start = cues[i - 1].start
      }
      cuesRef.current = cues

      const next = lessonRef.current?.scenes[sceneIndex + 1]
      if (next) narrator.prefetch(sceneIndex + 1, next.beats.join(' '))

      if (audio && playingRef.current) {
        audio.currentTime = 0
        void audio.play().catch(() => setIsPlaying(false))
      }
    })

    let last = performance.now()
    const tick = (now: number) => {
      if (cancelled) return
      const delta = (now - last) / 1000
      last = now
      if (playingRef.current) clock += delta

      const seconds = audio && !audio.paused ? audio.currentTime : clock
      let current = 0
      for (const cue of cuesRef.current) if (cue.start <= seconds) current = cue.beat

      setBeat((was) => (was === current ? was : current))

      const ended = audio ? audio.ended : seconds >= duration
      if (ended) {
        const total = lessonRef.current?.scenes.length ?? 0
        if (sceneIndex + 1 < total) setSceneIndex(sceneIndex + 1)
        else setIsPlaying(false)
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
  }, [sceneIndex, ready, scene?.n])

  // Reveal, and keep the rail on the sentence being spoken.
  useEffect(() => {
    if (boardRef.current) showBeat(boardRef.current, beat)
    const rail = railRef.current
    if (!rail) return
    for (const node of Array.from(rail.querySelectorAll<HTMLElement>('.beat'))) {
      const n = Number(node.dataset.n)
      node.classList.toggle('now', n === beat)
      node.classList.toggle('past', n < beat)
      if (n === beat) node.scrollIntoView({ block: 'nearest' })
    }
  }, [beat])

  const goToBeat = useCallback((n: number) => {
    setIsPlaying(false)
    const cue = cuesRef.current.find((c) => c.beat === n)
    const audio = audioRef.current
    if (cue && audio && Number.isFinite(audio.duration)) audio.currentTime = cue.start
    setBeat(n)
  }, [])

  const beats = scene?.beats ?? []

  return (
    <main className="slate flex h-dvh flex-col overflow-hidden">
      <header className="flex flex-wrap items-baseline gap-4 border-b border-[var(--rule)] bg-[var(--slate-deep)] px-4 py-3">
        <span className="mono text-[11px] uppercase tracking-[0.24em] text-[var(--chalk-faint)]">
          slate <b className="font-medium text-[var(--c-violet)]">engine</b>
        </span>
        <div className="min-w-0">
          <h1 className="m-0 truncate font-serif text-[22px] leading-tight">
            {lesson?.title || '—'}
          </h1>
          <p className="m-0 truncate text-[12.5px] text-[var(--chalk-faint)]">{lesson?.sub}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {chooser}
          <Chip onClick={() => setShowDesk((v) => !v)}>{showDesk ? 'hide source' : 'source'}</Chip>
          <Chip onClick={() => setShowChecks((v) => !v)} pressed={showChecks}>
            checks{errors.length ? ` · ${errors.length}` : ''}
          </Chip>
        </div>
      </header>

      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: showDesk ? 'minmax(280px,360px) minmax(0,1fr)' : '0 minmax(0,1fr)' }}>
        {showDesk && (
          <section className="flex min-h-0 flex-col border-r border-[var(--rule)] bg-[var(--slate-deep)]">
            <p className="border-b border-[var(--rule)] px-3 py-2 text-[12px] text-[var(--chalk-faint)]">
              Slate source. Shapes are timed with <span className="mono">|3</span>.
            </p>
            <textarea
              value={source}
              onChange={(event) => setSource(event.target.value)}
              spellCheck={false}
              className="mono min-h-0 flex-1 resize-none bg-[var(--slate-edge)] px-3 py-3 text-[12.5px] leading-[1.7] text-[var(--chalk-soft)] outline-none"
            />
            <p className="border-y border-[var(--rule)] px-3 py-2 text-[12px] text-[var(--chalk-faint)]">
              The script. One sentence, one beat.
            </p>
            <textarea
              value={script}
              onChange={(event) => setScript(event.target.value)}
              spellCheck={false}
              className="mono h-40 shrink-0 resize-none bg-[var(--slate-edge)] px-3 py-3 text-[12.5px] leading-[1.7] text-[var(--chalk-soft)] outline-none"
            />
          </section>
        )}

        <section className="flex min-h-0 flex-col">
          <nav className="flex shrink-0 overflow-x-auto border-b border-[var(--rule)] bg-[var(--slate-deep)]">
            {(lesson?.scenes ?? []).map((s, i) => (
              <button
                key={s.n}
                type="button"
                onClick={() => {
                  setIsPlaying(false)
                  setSceneIndex(i)
                }}
                aria-current={i === sceneIndex}
                className={`mono whitespace-nowrap border-b-2 px-4 py-2 text-[11px] tracking-[0.14em] ${
                  i === sceneIndex
                    ? 'border-[var(--c-violet)] text-[var(--chalk)]'
                    : 'border-transparent text-[var(--chalk-faint)]'
                }`}
              >
                scene {s.n}
              </button>
            ))}
          </nav>

          <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: '236px minmax(0,1fr)' }}>
            <nav ref={railRef} className="slate-rail">
              <p className="railhead">Scene {scene?.n ?? '–'}</p>
              {beats.map((sentence, i) => (
                <button
                  key={i}
                  type="button"
                  data-n={i + 1}
                  onClick={() => goToBeat(i + 1)}
                  className="beat"
                >
                  <span className="n">{i + 1}</span>
                  <span>{sentence}</span>
                </button>
              ))}
            </nav>
            <div ref={boardRef} className="slate-board" />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--rule)] bg-[var(--slate-deep)] px-4 py-2">
            <Chip onClick={() => setSceneIndex((i) => Math.max(0, i - 1))}>◀◀</Chip>
            <Chip onClick={() => goToBeat(Math.max(0, beat - 1))}>◀</Chip>
            <Chip onClick={() => setIsPlaying((v) => !v)} pressed={isPlaying}>
              {isPlaying ? 'pause' : 'play'}
            </Chip>
            <Chip onClick={() => goToBeat(Math.min(beats.length, beat + 1))}>▶</Chip>
            <Chip
              onClick={() =>
                setSceneIndex((i) => Math.min((lesson?.scenes.length ?? 1) - 1, i + 1))
              }
            >
              ▶▶
            </Chip>
            <span className="mono ml-2 text-[10.5px] tracking-[0.14em] text-[var(--chalk-faint)]">
              scene <b className="font-medium text-[var(--chalk)]">{scene?.n ?? '–'}</b> · beat{' '}
              <b className="font-medium text-[var(--chalk)]">{beat}</b>/{beats.length}
            </span>
          </div>

          {showChecks && (
            <div className="max-h-40 shrink-0 overflow-auto border-t border-[var(--rule)] bg-[var(--slate-edge)] px-4 py-2">
              {problems.length === 0 ? (
                <p className="mono m-0 text-[11.5px] text-[var(--c-green)]">
                  No problems. {lesson?.scenes.length ?? 0} scenes parsed.
                </p>
              ) : (
                problems.slice(0, 60).map((problem, i) => (
                  <p
                    key={i}
                    className="mono m-0 mb-1 text-[11.5px]"
                    style={{
                      color: problem.level === 'err' ? 'var(--c-red)' : 'var(--c-yellow)',
                    }}
                  >
                    {problem.level === 'err' ? 'error' : 'warning'}
                    {problem.line ? `  line ${problem.line}` : ''} — {problem.msg}
                  </p>
                ))
              )}
            </div>
          )}
        </section>
      </div>
      {/* Kept out of the tree above so switching scenes never remounts it. */}
      <audio hidden />
      <span hidden>{provider}{model}</span>
    </main>
  )
}

function Chip({
  children,
  onClick,
  pressed,
}: {
  children: React.ReactNode
  onClick: () => void
  pressed?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`mono rounded-sm border px-3 py-1.5 text-[10.5px] uppercase tracking-[0.13em] transition ${
        pressed
          ? 'border-[var(--c-violet)] bg-[var(--c-violet)] text-[var(--slate-deep)]'
          : 'border-[var(--rule)] text-[var(--chalk-soft)] hover:border-[var(--chalk-soft)] hover:text-[var(--chalk)]'
      }`}
    >
      {children}
    </button>
  )
}
