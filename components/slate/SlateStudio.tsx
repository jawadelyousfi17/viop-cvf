'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Engine } from '@/lib/engines'
import type { Provider } from '@/lib/providers'
import { DEFAULT_VOICE_ID, type VoiceId } from '@/lib/voices'
import { Narrator } from '../narrator'
import { VoicePicker } from '../VoicePicker'
import type { SavedScript } from '@/app/api/scripts/route'
import { parseScript as parseWrittenScript } from '@/lib/script-import'
import { SLATE_YAML_SYSTEM, slateYamlScriptPrompt } from '@/lib/slate-yaml-prompt'
import { narrationScenes, parseLesson, splitSentences, type SlateLesson } from '@/lib/slate'
import { looksLikeYaml, parseYamlLesson } from '@/lib/slate-yaml'
import { lint } from '@/lib/slate-lint'
import { drawScene, fitBoard, roughen, showBeat, wireBoard } from './draw'
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
  {
    id: 'docker-yaml',
    label: 'What a container is',
    note: '6 scenes · yaml',
    board: 'docker.yaml',
    script: 'docker.script.md',
  },
  // The same board, written the other way. Shipped side by side because the
  // only useful way to judge a format is to read one document in both.
  {
    id: 'docker',
    label: 'What a container is',
    note: '6 scenes · slate',
    board: 'docker.slate',
    script: 'docker.script.md',
  },
  {
    id: 'dns',
    label: 'How DNS finds an address',
    note: '3 scenes · slate',
    board: 'dns.slate',
    script: 'dns.script.md',
  },
  {
    id: 'docker-hood',
    label: 'Docker under the hood',
    note: '17 scenes · 9 min · real recording',
    board: 'docker-hood.yaml',
    script: 'docker-hood.script.md',
    cues: 'docker-hood.cues.json',
  },
  {
    id: 'routing',
    label: 'Getting past things',
    note: '1 scene · connector routing',
    board: 'routing.yaml',
    script: 'routing.yaml',
  },
  {
    id: 'blocks',
    label: 'Every block Slate has',
    note: '1 scene · a scratch board',
    board: 'blocks.yaml',
    script: 'blocks.yaml',
  },
  {
    id: 'three-ways',
    label: 'Three ways to ship',
    note: '1 scene · a three-part comparison',
    board: 'three-ways.yaml',
    script: 'three-ways.yaml',
  },
] as const

type ExampleId = (typeof EXAMPLES)[number]['id']

/**
 * A recording, and when each beat is spoken in it.
 *
 * The usual path synthesises a clip per scene and hunts for each sentence in
 * the provider's alignment. A cue sheet is the same information arrived at
 * honestly: the words were recorded by a person, the timings came with the
 * transcript, and `scripts/align-transcript.mjs` turned them into numbers once.
 * No key, no network, no guessing.
 */
interface CueSheet {
  audio: string
  duration: number
  scenes: { n: number; start: number; end: number; beats: number[] }[]
}

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
  const [example, setExample] = useState<ExampleId | null>(null)
  const [topic, setTopic] = useState('')
  const [writing, setWriting] = useState(false)
  const [sceneIndex, setSceneIndex] = useState(0)
  const [beat, setBeat] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showChecks, setShowChecks] = useState(false)
  const [showDesk, setShowDesk] = useState(false)
  const [showRail, setShowRail] = useState(false)
  const [voiceId, setVoiceId] = useState<VoiceId>(DEFAULT_VOICE_ID)
  const [saved, setSaved] = useState<SavedScript[]>([])
  const [openingScript, setOpeningScript] = useState<string | null>(null)
  const [picked, setPicked] = useState<{ title: string; text: string } | null>(null)
  const [pasted, setPasted] = useState('')
  const [sheet, setSheet] = useState<CueSheet | null>(null)
  const [copied, setCopied] = useState(false)
  // The board is not the first thing you see, for the same reason it is not the
  // first thing you see on the whiteboard tab: a player with nothing loaded is
  // a wall of controls for a thing that does not exist yet.
  const [playing, setPlaying] = useState(false)

  // Which of the two front ends wrote this. Detected rather than configured:
  // the two produce the same board, so the only thing the choice can break is
  // the parse, and that is decidable from the first line.
  const isYaml = useMemo(() => looksLikeYaml(source), [source])

  // Reparsed as it is typed. Both parsers are a few hundred lines of string
  // handling, so this is cheaper than the render it feeds — and a language
  // whose errors arrive a second late is one you argue with.
  const lesson = useMemo<SlateLesson | null>(() => {
    if (!source.trim()) return null
    const words = narrationScenes(script)
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
  /** Where the board is on the clock, so a seek survives being paused. */
  const clockRef = useRef(0)
  const lessonRef = useRef<SlateLesson | null>(null)

  const errors = problems.filter((p) => p.level === 'err')

  // The examples ship with the engine: something has to be on screen before
  // anyone has written a line, or the first impression is an empty box.
  useEffect(() => {
    if (!example) return
    let live = true
    const chosen = EXAMPLES.find((e) => e.id === example) ?? EXAMPLES[0]
    const sheet = 'cues' in chosen && chosen.cues ? String(chosen.cues) : null
    void Promise.all([
      fetch(`/api/slate?name=${chosen.board}`).then((r) => r.text()),
      fetch(`/api/slate?name=${chosen.script}`).then((r) => r.text()),
      sheet ? fetch(`/api/slate?name=${sheet}`).then((r) => r.json()) : Promise.resolve(null),
    ])
      .then(([board, words, sheetJson]) => {
        if (!live) return
        audioRef.current?.pause()
        audioRef.current = null
        setSheet(sheetJson as CueSheet | null)
        setSource(board)
        setScript(words)
        setSceneIndex(0)
        setPlaying(true)
        // Starts itself, the way the whiteboard does. A board that opens
        // paused opens *blank* — beat zero has nothing drawn on it — so the
        // first thing you saw was an empty page and silence, and the only cure
        // was finding a button you had no reason to look for.
        setIsPlaying(true)
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

  // The scripts on disk, with whether their narration is already synthesised.
  // Asked again when the voice changes, because "voice ready" is a fact about
  // a script *and a voice*, not about a script.
  useEffect(() => {
    let live = true
    void fetch(`/api/scripts?voice=${encodeURIComponent(voiceId)}`)
      .then((r) => r.json())
      .then((data: { scripts?: SavedScript[] }) => live && setSaved(data.scripts ?? []))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [voiceId])

  // A voice change means a different recording, so the cached one has to go.
  useEffect(() => {
    if (sheet) return
    narratorRef.current?.dispose()
    narratorRef.current = null
    audioRef.current?.pause()
    audioRef.current = null
  }, [voiceId, sheet])

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

    // The rows go on a sheet — a page of fixed width that rows wrap against,
    // and the thing the zoom scales. Without one there is nothing to measure:
    // a full-width board is always exactly as wide as the window.
    const { fragment, pristine } = drawScene(lesson, scene, registry)
    const sheet = document.createElement('div')
    sheet.className = 'sheet'
    sheet.appendChild(fragment)
    board.textContent = ''
    board.appendChild(sheet)
    Object.assign(registryRef.current, pristine)
    showBeat(board, 0)
    setBeat(0)

    // Outlines are drawn by hand, which means drawn after layout — and again
    // whenever layout changes underneath them. The font is the one that catches
    // people out: the board is laid out in the fallback face, every box is
    // sized to it, and then the real hand arrives and every box is a different
    // width with a straight-edged border still pinned to the old one.
    // Order matters: the page width decides how rows wrap, wrapping decides
    // every shape's size, and a connector cannot be aimed until both of its
    // ends have stopped moving.
    const redraw = () => {
      fitBoard(board)
      roughen(board)
      wireBoard(board)
    }
    redraw()
    void document.fonts?.ready.then(redraw)

    const observer = new ResizeObserver(redraw)
    observer.observe(board)
    return () => observer.disconnect()
  }, [lesson, scene, playing])

  // The voice, and the clock it puts the beats on.
  /**
   * A scene whose narration is already recorded.
   *
   * One long file, seeked rather than fetched per scene, and beats read
   * straight off the cue sheet — so the board is on the word, not near it.
   */
  useEffect(() => {
    const recorded = sheet?.scenes.find((s) => s.n === scene?.n)
    if (!scene || !ready || !playing || !recorded) return

    const audio = (audioRef.current ??= new Audio(sheet!.audio))
    if (!audio.src.endsWith(encodeURI(sheet!.audio))) audio.src = sheet!.audio
    audio.currentTime = recorded.start
    cuesRef.current = recorded.beats.map((start, i) => ({
      scene: scene.n,
      beat: i + 1,
      text: scene.beats[i] ?? '',
      start,
    }))
    if (playingRef.current) void audio.play().catch(() => setIsPlaying(false))

    let frame = 0
    let cancelled = false
    const tick = () => {
      if (cancelled) return
      if (playingRef.current) {
        const at = audio.currentTime
        let current = 0
        for (const cue of cuesRef.current) if (cue.start <= at) current = cue.beat
        setBeat((was) => (was === current ? was : current))

        // The scene is a stretch of one recording, so it ends at a timestamp
        // rather than at the end of a file.
        if (at >= recorded.end) {
          const total = lessonRef.current?.scenes.length ?? 0
          if (sceneIndex + 1 < total) setSceneIndex(sceneIndex + 1)
          else {
            audio.pause()
            setIsPlaying(false)
          }
          return
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneIndex, ready, playing, sheet, scene?.n])

  useEffect(() => {
    if (!scene || !ready || !playing) return
    // A recording needs no voice: the effect above is driving this scene.
    if (sheet?.scenes.some((s) => s.n === scene.n)) return

    narratorRef.current ??= new Narrator(voiceId)
    const narrator = narratorRef.current
    const narration = scene.beats.join(' ')
    if (!narration.trim()) return

    let cancelled = false
    let frame = 0
    let audio: HTMLAudioElement | null = null

    // Estimated first, so the board moves before the audio has landed.
    clockRef.current = 0
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
      if (playingRef.current) clockRef.current += delta

      const seconds = audio && !audio.paused ? audio.currentTime : clockRef.current

      // Only the clock moves the board. A paused board stays where it was put:
      // the loop used to recompute the beat every frame regardless, so stepping
      // forward with the transport was undone before the next paint.
      //
      // The test is the transport, not `audio.paused` — an ended element
      // reports itself paused, so asking the audio whether it is running means
      // the scene that just finished can never be noticed as finished.
      if (playingRef.current) {
        let current = 0
        for (const cue of cuesRef.current) if (cue.start <= seconds) current = cue.beat
        setBeat((was) => (was === current ? was : current))
      }

      const ended = playingRef.current && (audio ? audio.ended : seconds >= duration)
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
  }, [sceneIndex, ready, playing, voiceId, sheet, scene?.n])

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
    if ((!topic.trim() && !picked) || writing) return
    setSheet(null)
    setWriting(true)
    setIsPlaying(false)
    setSceneIndex(0)
    setSource('')
    setPlaying(true)
    setShowDesk(true)
    try {
      const response = await fetch('/api/slate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          picked ? { script: picked.text, provider, model } : { topic, provider, model }
        ),
      })
      if (!response.ok || !response.body) {
        const { error } = await response.json().catch(() => ({ error: 'Could not reach the model.' }))
        setSource(`# ${error}\n`)
        return
      }
      // A board written *for* a script keeps that script — its words are
      // already recorded. A board written from a topic brings its own.
      if (!picked) setScript('')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let text = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setSource(text)
      }
      setIsPlaying(true)
    } finally {
      setWriting(false)
    }
  }, [topic, writing, picked, provider, model])

  /** Opens a written script. Its words are fixed; only the board is missing. */
  const openScript = useCallback(async (name: string, title: string) => {
    setOpeningScript(name)
    try {
      const response = await fetch(`/api/scripts?name=${encodeURIComponent(name)}`)
      if (!response.ok) throw new Error(String(response.status))
      const { text } = (await response.json()) as { text: string }
      setScript(text)
      setPicked({ title, text })
      setSource('')
    } catch {
      setPicked(null)
    } finally {
      setOpeningScript(null)
    }
  }, [])

  /**
   * The whole input for a model asked to write the board for the picked script.
   *
   * The sentences are numbered here rather than described, because those
   * numbers ARE the beats — a model that can count to six can time a board, and
   * cannot paraphrase an integer.
   */
  const promptForBoard = useMemo(
    () =>
      picked
        ? `${SLATE_YAML_SYSTEM}\n\n${slateYamlScriptPrompt(
            parseWrittenScript(picked.text).map((scene, i) => ({
              n: i + 1,
              sentences: splitSentences(scene.narration),
            }))
          )}`
        : '',
    [picked]
  )

  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(promptForBoard)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked — the box below is still there to select from.
    }
  }, [promptForBoard])

  /** Draws whatever was pasted back in, against the script it was written for. */
  const drawPasted = useCallback(() => {
    if (!pasted.trim()) return
    setSource(pasted)
    setSceneIndex(0)
    setPlaying(true)
    setShowDesk(true)
    setIsPlaying(true)
  }, [pasted])

  const goToBeat = useCallback((n: number) => {
    setIsPlaying(false)
    const cue = cuesRef.current.find((c) => c.beat === n)
    const audio = audioRef.current
    // Move the clock too, so resuming carries on from where you looked rather
    // than snapping back to wherever the audio happened to be.
    clockRef.current = cue?.start ?? 0
    if (cue && audio && Number.isFinite(audio.duration)) audio.currentTime = cue.start
    setBeat(n)
  }, [])
  const beats = scene?.beats ?? []
  const chosen = EXAMPLES.find((e) => e.id === example)

  // ---- the topic screen ----------------------------------------------------
  // The same shape as the whiteboard's: name a thing, or open one that is
  // already written. Two ways in, side by side, because an example is the
  // fastest way to see what the engine does and a topic is the reason you came.
  if (!playing) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-6 py-16">
        <div className="w-full max-w-2xl">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
            viop · slate
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            What should I teach you?
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-500">
            Name a topic and I&rsquo;ll write the board as YAML, then draw it by hand — shapes
            timed to the sentence that explains them. Or open one that is already written and
            watch it play.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {chooser}
            <VoicePicker value={voiceId} onChange={setVoiceId} />
          </div>

          {/* Scripts already written, and already recorded. The board is the
              only thing missing, and the words must come back byte for byte. */}
          {saved.length > 0 && (
            <div className="mt-8">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                A written script
              </p>
              <div className="flex flex-wrap gap-2">
                {saved.map((entry) => (
                  <button
                    key={entry.name}
                    type="button"
                    onClick={() => void openScript(entry.name, entry.title)}
                    className={`flex items-baseline gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-left shadow-sm transition ${
                      picked?.title === entry.title
                        ? 'border-zinc-900'
                        : 'border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    <span className="text-sm font-medium text-zinc-800">{entry.title}</span>
                    <span className="text-xs text-zinc-400">
                      {openingScript === entry.name ? 'opening…' : `${entry.scenes} scenes`}
                    </span>
                    {openingScript !== entry.name &&
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

              {/* Two ways to get a board for it: let the model here write one,
                  or take the prompt to a model somewhere else and bring the
                  YAML back. The second exists because the best model available
                  is not always the one with an API key in this repo. */}
              {picked && (
                <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <p className="text-sm text-zinc-800">
                    <span className="font-medium">{picked.title}</span>
                    <span className="text-zinc-400">
                      {' '}
                      · {parseWrittenScript(picked.text).length} scenes, words already written
                    </span>
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void write()}
                      disabled={writing}
                      className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
                    >
                      {writing ? 'Writing…' : 'Write the YAML for it'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyPrompt()}
                      className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400"
                    >
                      {copied ? 'Copied' : 'Copy prompt'}
                    </button>
                    <span className="self-center text-xs text-zinc-400">
                      {promptForBoard ? `${Math.round(promptForBoard.length / 3.7)} tokens` : ''}
                    </span>
                  </div>

                  <label
                    htmlFor="slate-paste"
                    className="mt-4 mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400"
                  >
                    Paste the YAML back
                  </label>
                  <textarea
                    id="slate-paste"
                    value={pasted}
                    onChange={(event) => setPasted(event.target.value)}
                    spellCheck={false}
                    rows={5}
                    placeholder={'title: …\nscenes:\n  - n: 1'}
                    className="w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-[12px] leading-[1.6] text-zinc-700 outline-none transition focus:border-zinc-400"
                  />
                  <button
                    type="button"
                    onClick={drawPasted}
                    disabled={!pasted.trim()}
                    className="mt-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 disabled:opacity-40"
                  >
                    Draw it
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mt-8">
            <label
              htmlFor="slate-topic"
              className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400"
            >
              Or just a topic
            </label>
            <div className="flex gap-2">
              <input
                id="slate-topic"
                value={topic}
                onChange={(event) => {
                  setTopic(event.target.value)
                  if (event.target.value) setPicked(null)
                }}
                onKeyDown={(event) => event.key === 'Enter' && void write()}
                placeholder="how a CPU cache works"
                disabled={writing}
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 disabled:animate-pulse"
              />
              <button
                type="button"
                onClick={() => void write()}
                disabled={!topic.trim() || writing}
                className="shrink-0 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {writing ? 'Writing…' : 'Write the board'}
              </button>
            </div>
          </div>

          {/* Boards already written, kept on disk and read back over the API —
              so editing one is editing a file, not a string in a bundle. */}
          <div className="mt-6">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">
              Or open a finished board
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setExample(entry.id)}
                  className="flex items-baseline gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-left shadow-sm transition hover:border-zinc-400"
                >
                  <span className="text-sm font-medium text-zinc-800">{entry.label}</span>
                  <span className="text-xs text-zinc-400">{entry.note}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ---- the player ----------------------------------------------------------
  // Board, and a transport. Everything else — the source, the script, the
  // checks — is a panel you ask for, because none of it is what you are here
  // to look at.
  return (
    <div className={`slate fixed inset-0${showDesk ? ' tagged' : ''}`}>
      <div ref={boardRef} className="slate-board absolute inset-0" />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-3 p-4">
        <div className="pointer-events-auto min-w-0 rounded-xl border border-black/10 bg-white/90 px-3.5 py-2 shadow-sm backdrop-blur">
          <p className="m-0 truncate text-sm font-medium text-zinc-800">
            {lesson?.title || 'Untitled'}
          </p>
          <p className="m-0 truncate text-xs text-zinc-400">
            {chosen?.label ?? 'written just now'} · {isYaml ? 'yaml' : 'slate'}
          </p>
        </div>

        <div className="pointer-events-auto ml-auto flex flex-wrap items-start justify-end gap-2">
          <div className="pointer-events-auto"><VoicePicker value={voiceId} onChange={setVoiceId} /></div>
          <Pill onClick={() => setShowRail((v) => !v)} pressed={showRail}>
            Script
          </Pill>
          <Pill onClick={() => setShowDesk((v) => !v)} pressed={showDesk}>
            Source
          </Pill>
          <Pill onClick={() => setShowChecks((v) => !v)} pressed={showChecks} alert={errors.length}>
            Checks{errors.length ? ` · ${errors.length}` : ''}
          </Pill>
          <Pill
            onClick={() => {
              setIsPlaying(false)
              setPlaying(false)
              setExample(null)
            }}
          >
            New topic
          </Pill>
        </div>
      </header>

      {/* The narration, one sentence a beat. Click one to seek to it. */}
      {showRail && (
        <aside
          ref={railRef}
          className="slate-rail absolute bottom-24 left-4 top-24 z-10 w-64 rounded-xl border border-black/10 bg-white/95 shadow-lg shadow-black/5 backdrop-blur"
        >
          <p className="railhead">Scene {scene?.n ?? '–'}</p>
          {beats.map((sentence, i) => (
            <button key={i} type="button" data-n={i + 1} onClick={() => goToBeat(i + 1)} className="beat">
              <span className="n">{i + 1}</span>
              <span>{sentence}</span>
            </button>
          ))}
        </aside>
      )}

      {/* The document itself. Editable, and reparsed as you type. */}
      {showDesk && (
        <aside className="absolute bottom-24 right-4 top-24 z-10 flex w-[min(30rem,45vw)] flex-col overflow-hidden rounded-xl border border-black/10 bg-white/95 shadow-lg shadow-black/5 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-black/10 px-3 py-2">
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              {isYaml ? 'yaml' : 'slate'}
            </span>
            <span className="text-xs text-zinc-400">
              timed with <code className="font-mono">{isYaml ? 'at: 3' : '|3'}</code>
            </span>
          </div>
          <textarea
            value={source}
            onChange={(event) => setSource(event.target.value)}
            spellCheck={false}
            className="mono min-h-0 flex-1 resize-none bg-transparent px-3 py-3 text-[12.5px] leading-[1.7] text-zinc-700 outline-none"
          />
          <div className="border-t border-black/10 px-3 py-2 text-xs text-zinc-400">The script</div>
          <textarea
            value={script}
            onChange={(event) => setScript(event.target.value)}
            spellCheck={false}
            className="mono h-28 shrink-0 resize-none bg-transparent px-3 py-2 text-[12.5px] leading-[1.7] text-zinc-700 outline-none"
          />
        </aside>
      )}

      {showChecks && (
        <div className="absolute inset-x-4 bottom-24 z-10 max-h-44 overflow-auto rounded-xl border border-black/10 bg-white/95 p-3 shadow-lg shadow-black/5 backdrop-blur">
          {problems.length === 0 ? (
            <p className="m-0 font-mono text-[11.5px] text-emerald-600">
              No problems. {lesson?.scenes.length ?? 0} scenes parsed.
            </p>
          ) : (
            problems.slice(0, 60).map((problem, i) => (
              <p
                key={i}
                className={`m-0 mb-1 font-mono text-[11.5px] ${
                  problem.level === 'err' ? 'text-red-600' : 'text-amber-600'
                }`}
              >
                {problem.level === 'err' ? 'error' : 'warning'}
                {problem.line ? `  line ${problem.line}` : ''} — {problem.msg}
              </p>
            ))
          )}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-5">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-black/10 bg-white/90 px-3 py-2 shadow-lg shadow-black/5 backdrop-blur">
          <Step label="Previous scene" onClick={() => setSceneIndex((i) => Math.max(0, i - 1))} disabled={sceneIndex === 0}>
            <path d="M14 5 8 10l6 5V5Z" />
            <path d="M6 5v10" />
          </Step>
          <Step label="Previous beat" onClick={() => goToBeat(Math.max(0, beat - 1))} disabled={beat === 0}>
            <path d="M12.5 5 7 10l5.5 5" />
          </Step>

          <button
            type="button"
            onClick={() => setIsPlaying((v) => !v)}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-700"
          >
            {isPlaying ? (
              <svg viewBox="0 0 20 20" className="size-5" fill="currentColor">
                <rect x="5.5" y="4" width="3.5" height="12" rx="1" />
                <rect x="11" y="4" width="3.5" height="12" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" className="size-5" fill="currentColor">
                <path d="M6.5 4.2v11.6a.6.6 0 0 0 .92.5l9-5.8a.6.6 0 0 0 0-1l-9-5.8a.6.6 0 0 0-.92.5Z" />
              </svg>
            )}
          </button>

          <Step label="Next beat" onClick={() => goToBeat(Math.min(beats.length, beat + 1))} disabled={beat >= beats.length}>
            <path d="M7.5 5 13 10l-5.5 5" />
          </Step>
          <Step
            label="Next scene"
            onClick={() => setSceneIndex((i) => Math.min((lesson?.scenes.length ?? 1) - 1, i + 1))}
            disabled={sceneIndex >= (lesson?.scenes.length ?? 1) - 1}
          >
            <path d="M6 5l6 5-6 5V5Z" />
            <path d="M14 5v10" />
          </Step>

          <span className="mx-1 h-6 w-px bg-black/10" />
          <span className="whitespace-nowrap px-1 text-xs tabular-nums text-zinc-400">
            scene {scene?.n ?? '–'}/{lesson?.scenes.length ?? 0} · beat {beat}/{beats.length}
          </span>
        </div>
      </div>

      {/* Kept out of the tree above so switching scenes never remounts it. */}
      <audio hidden />
      <span hidden>{provider}{model}</span>
    </div>
  )
}

/** A control in the top bar. Same weight as the whiteboard's, same shape. */
function Pill({
  children,
  onClick,
  pressed,
  alert,
}: {
  children: React.ReactNode
  onClick: () => void
  pressed?: boolean
  alert?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`rounded-xl border px-3.5 py-2 text-sm font-medium shadow-sm backdrop-blur transition ${
        pressed
          ? 'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700'
          : alert
            ? 'border-red-200 bg-white/90 text-red-600 hover:bg-white'
            : 'border-black/10 bg-white/90 text-zinc-700 hover:bg-white hover:text-zinc-900'
      }`}
    >
      {children}
    </button>
  )
}

/** A transport step. Traced, not filled, so it reads as a control not a shape. */
function Step({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-30"
    >
      <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
}
