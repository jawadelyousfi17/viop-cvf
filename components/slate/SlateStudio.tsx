'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Engine } from '@/lib/engines'
import type { Provider } from '@/lib/providers'
import { DEFAULT_VOICE_ID, type VoiceId } from '@/lib/voices'
import { Narrator } from '../narrator'
import { parseLesson, parseScript, type SlateLesson } from '@/lib/slate'
import { looksLikeYaml, parseYamlLesson } from '@/lib/slate-yaml'
import { lint } from '@/lib/slate-lint'
import { drawScene, roughen, showBeat } from './draw'
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

/**
 * The boards that ship with the engine.
 *
 * Two, deliberately. One is a sequence of questions and answers, which is what
 * the language was first built for; the other is a diagram that argues, changes
 * and gets pointed at, which is what `group`, `compare`, `focus` and
 * `transform` were built for. A language demonstrated on one kind of lesson
 * only looks general until you try the other.
 */
const EXAMPLES = [
  { id: 'dns', label: 'dns', board: 'dns.slate', script: 'dns.script.md' },
  { id: 'docker', label: 'docker', board: 'docker.slate', script: 'docker.script.md' },
  // The same board, written the other way. Shipped side by side because the
  // only useful way to judge a format is to read one document in both.
  { id: 'docker-yaml', label: 'docker · yaml', board: 'docker.yaml', script: 'docker.script.md' },
] as const

type ExampleId = (typeof EXAMPLES)[number]['id']

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
  const [example, setExample] = useState<ExampleId>('docker-yaml')
  const [topic, setTopic] = useState('')
  const [writing, setWriting] = useState(false)
  const [sceneIndex, setSceneIndex] = useState(0)
  const [beat, setBeat] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showChecks, setShowChecks] = useState(false)
  const [showDesk, setShowDesk] = useState(true)

  // Which of the two front ends wrote this. Detected rather than configured:
  // the two produce the same board, so the only thing the choice can break is
  // the parse, and that is decidable from the first line.
  const isYaml = useMemo(() => looksLikeYaml(source), [source])

  // Reparsed as it is typed. Both parsers are a few hundred lines of string
  // handling, so this is cheaper than the render it feeds — and a language
  // whose errors arrive a second late is one you argue with.
  const lesson = useMemo<SlateLesson | null>(() => {
    if (!source.trim()) return null
    const words = parseScript(script)
    return isYaml ? parseYamlLesson(source, words) : parseLesson(source, words)
  }, [source, script, isYaml])
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
    const chosen = EXAMPLES.find((e) => e.id === example) ?? EXAMPLES[0]
    void Promise.all([
      fetch(`/api/slate?name=${chosen.board}`).then((r) => r.text()),
      fetch(`/api/slate?name=${chosen.script}`).then((r) => r.text()),
    ])
      .then(([board, words]) => {
        if (!live) return
        setSource(board)
        setScript(words)
        setSceneIndex(0)
        setIsPlaying(false)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [example])

  useEffect(
    () => () => {
      narratorRef.current?.dispose()
      audioRef.current?.pause()
    },
    []
  )

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
    //
    // What is registered is the *pristine* copy, not the one in the document. A
    // scene that transforms a shape it carried would otherwise hand the
    // transformed version forward, and since the current scene is drawn twice —
    // once here and once to display — every redraw would transform it again.
    const registry: Record<string, HTMLElement> = {}
    for (const past of lesson.scenes) {
      Object.assign(registry, drawScene(lesson, past, registry).pristine)
    }
    registryRef.current = registry

    const { fragment, pristine } = drawScene(lesson, scene, registry)
    board.textContent = ''
    board.appendChild(fragment)
    Object.assign(registryRef.current, pristine)
    showBeat(board, 0)
    setBeat(0)

    // Outlines are drawn by hand, which means drawn after layout — and again
    // whenever layout changes underneath them. The font is the one that catches
    // people out: the board is laid out in the fallback face, every box is
    // sized to it, and then the real hand arrives and every box is a different
    // width with a straight-edged border still pinned to the old one.
    roughen(board)
    void document.fonts?.ready.then(() => roughen(board))

    const observer = new ResizeObserver(() => roughen(board))
    observer.observe(board)
    return () => observer.disconnect()
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

  /**
   * Asks the model for a board and streams it into the source pane.
   *
   * Written straight into the editor rather than into some hidden state: what
   * arrives is a document, the same one a person would have typed, and being
   * able to watch it land — and then fix a line of it — is most of what makes
   * a generated board usable.
   */
  const write = useCallback(async () => {
    if (!topic.trim() || writing) return
    setWriting(true)
    setIsPlaying(false)
    setSource('')
    try {
      const response = await fetch('/api/slate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic, provider, model }),
      })
      if (!response.ok || !response.body) {
        const { error } = await response.json().catch(() => ({ error: 'Could not reach the model.' }))
        setSource(`# ${error}\n`)
        return
      }
      // A board written by a script keeps that script; a board written from a
      // topic brings its own narration, so the old words have to go.
      setScript('')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let text = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setSource(text)
      }
    } finally {
      setWriting(false)
    }
  }, [topic, writing, provider, model])

  const goToBeat = useCallback((n: number) => {
    setIsPlaying(false)
    const cue = cuesRef.current.find((c) => c.beat === n)
    const audio = audioRef.current
    if (cue && audio && Number.isFinite(audio.duration)) audio.currentTime = cue.start
    setBeat(n)
  }, [])

  const beats = scene?.beats ?? []

  return (
    <main className={`slate flex h-dvh flex-col overflow-hidden${showDesk ? ' tagged' : ''}`}>
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
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--rule)] px-3 py-2">
              <span
                className="mono rounded-sm border border-[var(--rule)] px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
                style={{ color: isYaml ? 'var(--c-violet)' : 'var(--chalk-faint)' }}
                title="Which front end parsed this document"
              >
                {isYaml ? 'yaml' : 'slate'}
              </span>
              <p className="m-0 mr-auto text-[12px] text-[var(--chalk-faint)]">
                Timed with <span className="mono">{isYaml ? 'at: 3' : '|3'}</span>.
              </p>
              {EXAMPLES.map((choice) => (
                <Chip
                  key={choice.id}
                  onClick={() => setExample(choice.id)}
                  pressed={example === choice.id}
                >
                  {choice.label}
                </Chip>
              ))}
            </div>

            <div className="flex items-center gap-2 border-b border-[var(--rule)] px-3 py-2">
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && void write()}
                placeholder="a topic to teach…"
                className="mono min-w-0 flex-1 rounded-sm border border-[var(--rule)] bg-[var(--slate-edge)] px-2 py-1.5 text-[12px] text-[var(--chalk)] outline-none placeholder:text-[var(--chalk-faint)]"
              />
              <Chip onClick={() => void write()} pressed={writing}>
                {writing ? 'writing…' : 'write yaml'}
              </Chip>
            </div>
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
