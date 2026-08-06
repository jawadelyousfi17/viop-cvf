'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from 'tldraw'
import {
  COLORS,
  DASHES,
  FILLS,
  POINT_KINDS,
  SHAPE_KINDS,
  SIZES,
  estimateNarrationSeconds,
  normalizeScene,
  type BoardShape,
  type Lesson,
  type Scene,
} from '@/lib/lesson'
import { checkLesson, toDemoModule, type SceneReport } from '@/lib/lesson-check'
import { CHART_KINDS, chartKey } from '@/lib/chart'
import { renderChart } from '../charts'
import { ImageBank } from '../images'
import { Narrator } from '../narrator'
import { DEFAULT_VOICE_ID, VOICES, type VoiceId } from '@/lib/voices'
import type { BoardPainter } from '../whiteboard/paint'

const Board = dynamic(() => import('../whiteboard/board'), { ssr: false })

const STORAGE_KEY = 'viop-author-lesson'

/** A shape with only what a new one needs; the rest takes the board's defaults. */
function blankShape(id: string, kind: BoardShape['kind']): BoardShape {
  return {
    id,
    kind,
    text: kind === 'image' ? 'a photograph of something' : kind === 'icon' ? '💡' : 'NEW',
    x: 200,
    y: 200,
    w: 320,
    h: 140,
    from: null,
    to: null,
    color: 'black',
    fill: 'none',
    size: 'm',
    dash: 'draw',
    at: 0.5,
    anchor: '',
    points: POINT_KINDS.has(kind)
      ? [
          { x: 200, y: 300 },
          { x: 600, y: 300 },
        ]
      : [],
    data: (CHART_KINDS as readonly string[]).includes(kind)
      ? [
          { label: 'one', value: 3 },
          { label: 'two', value: 7 },
        ]
      : [],
  }
}

function blankScene(index: number): Scene {
  return {
    id: `scene-${index}`,
    heading: '',
    narration: 'Say something here, and anchor each shape to the words that introduce it.',
    diagram: { source: '', timing: [] },
    shapes: [blankShape('s1', 'label')],
  }
}

const EMPTY_LESSON: Lesson = {
  title: 'Untitled board',
  summary: '',
  scenes: [blankScene(0)],
}

/**
 * A tool for building board lessons by hand.
 *
 * The board's hard parts are not the shapes, they are the timing and the
 * layout — whether a shape lands on the word that introduces it, and whether
 * the scene fills the screen without stacking on itself. Both are invisible
 * until you play the thing, which makes authoring by editing a TypeScript file
 * and reloading a slow way to find out you got it wrong.
 *
 * So this shows all three at once: the board as it will actually be drawn
 * (through the real painter, after the real layout pass), every check that
 * decides whether it plays well, and — once you press Narrate — where each
 * shape genuinely lands against the synthesised voice rather than against an
 * estimate of it.
 */
/**
 * Whatever was last being worked on. Read during the first render rather than
 * in an effect — authoring a six-scene board is an hour's work, and restoring
 * it a frame late means the board is painted once from the blank lesson and
 * then again from the draft.
 *
 * Safe to touch localStorage here because the page mounts client-only.
 */
function savedLesson(): Lesson {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return EMPTY_LESSON
    const parsed = JSON.parse(saved) as Lesson
    return Array.isArray(parsed.scenes) && parsed.scenes.length ? parsed : EMPTY_LESSON
  } catch {
    // A corrupt draft shouldn't stop the tool opening.
    return EMPTY_LESSON
  }
}

export default function AuthorStudio() {
  const [lesson, setLesson] = useState<Lesson>(savedLesson)
  const [sceneIndex, setSceneIndex] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'shapes' | 'json'>('shapes')
  const [jsonDraft, setJsonDraft] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [voiceId, setVoiceId] = useState<VoiceId>(DEFAULT_VOICE_ID)
  const [timing, setTiming] = useState<{ id: string; time: number | null; anchor: string }[] | null>(null)
  const [clip, setClip] = useState<number | null>(null)
  const [narrating, setNarrating] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const painterRef = useRef<BoardPainter | null>(null)
  const imagesRef = useRef<ImageBank | null>(null)
  const narratorRef = useRef<Narrator | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const frameRef = useRef(0)
  const [painterReady, setPainterReady] = useState(false)

  const scene = lesson.scenes[sceneIndex]
  const report = useMemo(() => checkLesson(lesson), [lesson])
  const sceneReport: SceneReport | undefined = report.scenes[sceneIndex]

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lesson))
      } catch {
        // Over quota, or private mode. Not worth interrupting anyone for.
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [lesson])

  const onEditor = useCallback((editor: Editor) => {
    void import('../whiteboard/paint').then(({ BoardPainter }) => {
      painterRef.current = new BoardPainter(editor)
      imagesRef.current = new ImageBank()
      setPainterReady(true)
    })
  }, [])

  /** The scene exactly as the player would draw it. */
  const drawn = useMemo(() => {
    if (!scene) return null
    try {
      return normalizeScene(structuredClone(scene), 0)
    } catch {
      return null
    }
  }, [scene])

  // Repaint on every edit. Everything is drawn at once and unanimated — this is
  // the composition view; Play is what shows the choreography.
  useEffect(() => {
    const painter = painterRef.current
    if (!painter || !drawn || playing) return

    painter.reset()
    for (const shape of drawn.shapes) painter.paint(0, shape, drawn.shapes, false)
    painter.focus(0, drawn.shapes, 0)

    const bank = imagesRef.current
    let live = true
    if (bank) {
      for (const shape of drawn.shapes) {
        if (shape.kind !== 'image' || !shape.text.trim()) continue
        void bank.get(shape.text).then((found) => {
          if (live && found) painter.addImage(shape.text, found)
        })
      }
    }
    for (const shape of drawn.shapes) {
      if (!(CHART_KINDS as readonly string[]).includes(shape.kind) || !shape.data.length) continue
      void renderChart(shape).then((found) => {
        if (live && found) painter.addImage(chartKey(0, shape.id), found)
      })
    }

    return () => {
      live = false
    }
  }, [drawn, painterReady, playing])

  function patchScene(patch: Partial<Scene>) {
    setLesson((prev) => {
      const scenes = [...prev.scenes]
      scenes[sceneIndex] = { ...scenes[sceneIndex], ...patch }
      return { ...prev, scenes }
    })
  }

  function patchShape(id: string, patch: Partial<BoardShape>) {
    patchScene({
      shapes: scene.shapes.map((shape) => (shape.id === id ? { ...shape, ...patch } : shape)),
    })
  }

  function addShape(kind: BoardShape['kind']) {
    let n = scene.shapes.length + 1
    while (scene.shapes.some((s) => s.id === `s${n}`)) n++
    const shape = blankShape(`s${n}`, kind)
    patchScene({ shapes: [...scene.shapes, shape] })
    setSelectedId(shape.id)
  }

  function removeShape(id: string) {
    patchScene({ shapes: scene.shapes.filter((s) => s.id !== id) })
    if (selectedId === id) setSelectedId(null)
  }

  function duplicateShape(id: string) {
    const source = scene.shapes.find((s) => s.id === id)
    if (!source) return
    let n = scene.shapes.length + 1
    while (scene.shapes.some((s) => s.id === `s${n}`)) n++
    const copy = { ...structuredClone(source), id: `s${n}`, y: source.y + 60 }
    patchScene({ shapes: [...scene.shapes, copy] })
    setSelectedId(copy.id)
  }

  /**
   * Turns the current text selection into the selected shape's anchor.
   *
   * The anchor has to appear in the narration character for character or the
   * shape quietly falls back to its `at` fraction — which is the single most
   * common way a board goes out of sync. Taking it from a real selection over
   * the real narration makes that impossible to get wrong.
   */
  function anchorFromSelection() {
    const text = window.getSelection()?.toString().trim()
    if (!text || !selectedId) return
    if (!scene.narration.includes(text)) {
      setStatus('That selection spans a gap in the narration — select inside one run of text.')
      return
    }
    patchShape(selectedId, { anchor: text })
    setStatus(`Anchored "${text}"`)
  }

  /** Fetches the real voiceover and reports where every shape actually lands. */
  async function narrate() {
    if (!drawn) return
    setNarrating(true)
    setStatus(null)
    try {
      narratorRef.current?.dispose()
      narratorRef.current = new Narrator(voiceId)
      const narration = await narratorRef.current.get(0, scene.narration)
      audioRef.current = narration.audio
      setClip(narration.duration)
      setTiming(
        drawn.shapes.map((shape) => ({
          id: shape.id,
          anchor: shape.anchor,
          time: shape.anchor ? narration.timeOf(shape.anchor) : shape.at * narration.duration,
        }))
      )
      if (!narratorRef.current.hasVoice) {
        setStatus('No voice key configured — times below are estimated from reading speed.')
      }
    } catch {
      setStatus('Could not fetch the voiceover.')
    } finally {
      setNarrating(false)
    }
  }

  /** Plays the scene the way the player would, against the fetched audio. */
  function play() {
    const painter = painterRef.current
    if (!painter || !drawn) return

    cancelAnimationFrame(frameRef.current)
    painter.reset()
    painter.focus(0, drawn.shapes, 0)
    setPlaying(true)

    const audio = audioRef.current
    const duration = clip ?? estimateNarrationSeconds(scene.narration)
    const byId = new Map((timing ?? []).map((t) => [t.id, t.time]))
    const schedule = drawn.shapes.map((shape) => ({
      shape,
      time: byId.get(shape.id) ?? shape.at * duration,
    }))

    if (audio) {
      audio.currentTime = 0
      void audio.play().catch(() => {})
    }
    const start = performance.now()

    const tick = (now: number) => {
      const seconds = audio && !audio.paused ? audio.currentTime : (now - start) / 1000
      for (const entry of schedule) {
        if (entry.time <= seconds) painter.paint(0, entry.shape, drawn.shapes)
      }
      if (seconds < duration + 0.4) frameRef.current = requestAnimationFrame(tick)
      else setPlaying(false)
    }
    frameRef.current = requestAnimationFrame(tick)
  }

  function stop() {
    cancelAnimationFrame(frameRef.current)
    audioRef.current?.pause()
    setPlaying(false)
  }

  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

  function download(name: string, body: string, type: string) {
    const url = URL.createObjectURL(new Blob([body], { type }))
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
  }

  const selected = scene?.shapes.find((s) => s.id === selectedId) ?? null

  if (!scene) return null

  return (
    <main className="flex h-dvh flex-col bg-zinc-100 text-zinc-900">
      {/* Top bar: the lesson, and what leaves the tool. */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2.5">
        <input
          value={lesson.title}
          onChange={(e) => setLesson({ ...lesson, title: e.target.value })}
          className="w-64 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium outline-none focus:border-zinc-400"
          placeholder="Lesson title"
        />
        <input
          value={lesson.summary}
          onChange={(e) => setLesson({ ...lesson, summary: e.target.value })}
          className="min-w-64 flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
          placeholder="One sentence on what the learner comes away with"
        />

        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${report.errors ? 'bg-red-100 text-red-700' : report.warnings ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {report.errors} errors · {report.warnings} warnings
        </span>

        <button onClick={() => download('lesson.json', JSON.stringify(lesson, null, 2), 'application/json')} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm transition hover:bg-zinc-50">
          Export JSON
        </button>
        <button onClick={() => download('demo-lesson.ts', toDemoModule(lesson), 'text/plain')} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700">
          Export as demo
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Scenes */}
        <nav className="flex w-44 shrink-0 flex-col border-r border-zinc-200 bg-white">
          <div className="flex-1 overflow-y-auto p-2">
            {lesson.scenes.map((s, i) => {
              const r = report.scenes[i]
              const bad = r?.issues.some((issue) => issue.severity === 'error')
              return (
                <button
                  key={s.id + i}
                  onClick={() => {
                    setSceneIndex(i)
                    setSelectedId(null)
                    setTiming(null)
                    setClip(null)
                  }}
                  className={`mb-1 w-full rounded-lg px-2.5 py-2 text-left text-sm transition ${i === sceneIndex ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-100'}`}
                >
                  <span className="flex items-center justify-between">
                    <span>Scene {i + 1}</span>
                    {bad && <span className={i === sceneIndex ? 'text-red-300' : 'text-red-600'}>●</span>}
                  </span>
                  <span className={`block truncate text-xs ${i === sceneIndex ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {r?.shapes ?? 0} shapes
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex gap-1 border-t border-zinc-200 p-2">
            <button
              onClick={() => {
                setLesson({ ...lesson, scenes: [...lesson.scenes, blankScene(lesson.scenes.length)] })
                setSceneIndex(lesson.scenes.length)
              }}
              className="flex-1 rounded-lg border border-zinc-200 py-1.5 text-sm transition hover:bg-zinc-50"
            >
              + Scene
            </button>
            <button
              disabled={lesson.scenes.length < 2}
              onClick={() => {
                const scenes = lesson.scenes.filter((_, i) => i !== sceneIndex)
                setLesson({ ...lesson, scenes })
                setSceneIndex(Math.max(0, sceneIndex - 1))
              }}
              className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-50 disabled:opacity-30"
            >
              −
            </button>
          </div>
        </nav>

        {/* Editor */}
        <section className="flex w-[26rem] shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white">
          <div className="flex gap-1 border-b border-zinc-200 p-2">
            {(['shapes', 'json'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t)
                  if (t === 'json') setJsonDraft(JSON.stringify(lesson, null, 2))
                }}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${tab === t ? 'bg-zinc-100 font-medium' : 'text-zinc-500 hover:bg-zinc-50'}`}
              >
                {t === 'shapes' ? 'Scene' : 'JSON'}
              </button>
            ))}
          </div>

          {tab === 'json' ? (
            <div className="flex flex-1 flex-col gap-2 p-3">
              <p className="text-xs text-zinc-500">
                The whole lesson. Paste one in to import it.
              </p>
              <textarea
                value={jsonDraft}
                onChange={(e) => {
                  setJsonDraft(e.target.value)
                  try {
                    const parsed = JSON.parse(e.target.value) as Lesson
                    if (!Array.isArray(parsed.scenes) || !parsed.scenes.length) {
                      throw new Error('needs a scenes array')
                    }
                    setLesson(parsed)
                    setSceneIndex((i) => Math.min(i, parsed.scenes.length - 1))
                    setJsonError(null)
                  } catch (cause) {
                    setJsonError(cause instanceof Error ? cause.message : 'Invalid JSON')
                  }
                }}
                spellCheck={false}
                className="min-h-0 flex-1 resize-none rounded-lg border border-zinc-200 p-2 font-mono text-[11px] leading-relaxed outline-none focus:border-zinc-400"
              />
              {jsonError && <p className="text-xs text-red-600">{jsonError}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-3">
              {/* Narration, and the anchor picker that works off it. */}
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Narration · {sceneReport?.words ?? 0} words
                </label>
                <textarea
                  value={scene.narration}
                  onChange={(e) => patchScene({ narration: e.target.value })}
                  rows={5}
                  className="w-full resize-y rounded-lg border border-zinc-200 p-2 text-sm leading-relaxed outline-none focus:border-zinc-400"
                />
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    onClick={anchorFromSelection}
                    disabled={!selectedId}
                    className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs transition hover:bg-zinc-50 disabled:opacity-40"
                    title="Select words above, then anchor the selected shape to them"
                  >
                    Anchor selection → {selectedId ?? 'no shape selected'}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Mermaid diagram
                </label>
                <textarea
                  value={scene.diagram?.source ?? ''}
                  onChange={(e) =>
                    patchScene({ diagram: { source: e.target.value, timing: scene.diagram?.timing ?? [] } })
                  }
                  rows={3}
                  spellCheck={false}
                  placeholder={'flowchart TD\n  A[One] -->|then| B[Two]'}
                  className="w-full resize-y rounded-lg border border-zinc-200 p-2 font-mono text-[11px] outline-none focus:border-zinc-400"
                />
              </div>

              {/* Shapes */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Shapes · {scene.shapes.length}
                  </label>
                  <select
                    value=""
                    onChange={(e) => e.target.value && addShape(e.target.value as BoardShape['kind'])}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-xs outline-none"
                  >
                    <option value="">+ add…</option>
                    {SHAPE_KINDS.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>

                <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                  {scene.shapes.map((shape) => {
                    const issues = sceneReport?.issues.filter((i) => i.shapeId === shape.id) ?? []
                    const broken = issues.some((i) => i.severity === 'error')
                    return (
                      <li key={shape.id}>
                        <button
                          onClick={() => setSelectedId(shape.id)}
                          className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs transition ${selectedId === shape.id ? 'bg-zinc-100' : 'hover:bg-zinc-50'}`}
                        >
                          <span className="w-14 shrink-0 font-mono text-zinc-400">{shape.id}</span>
                          <span className="w-20 shrink-0 text-zinc-600">{shape.kind}</span>
                          <span className="min-w-0 flex-1 truncate">{shape.text || '—'}</span>
                          {shape.anchor ? (
                            <span className="shrink-0 text-emerald-600" title={shape.anchor}>⌁</span>
                          ) : (
                            <span className="shrink-0 text-zinc-300" title="No anchor: timed by fraction only">⌁</span>
                          )}
                          {broken && <span className="shrink-0 text-red-600">●</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {selected && (
                <Inspector
                  shape={selected}
                  scene={scene}
                  onChange={(patch) => patchShape(selected.id, patch)}
                  onDuplicate={() => duplicateShape(selected.id)}
                  onRemove={() => removeShape(selected.id)}
                />
              )}
            </div>
          )}
        </section>

        {/* Board and checks */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 bg-white">
            <Board onEditor={onEditor} />
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={narrate} disabled={narrating} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm transition hover:bg-zinc-50 disabled:opacity-50">
                {narrating ? 'Narrating…' : 'Narrate & time'}
              </button>
              <button onClick={playing ? stop : play} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700">
                {playing ? 'Stop' : 'Play scene'}
              </button>
              <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value as VoiceId)}
                className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm outline-none"
              >
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>

              {sceneReport && (
                <span className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
                  <span>{Math.round(sceneReport.widthUsed * 100)}% width</span>
                  <span>aspect {sceneReport.aspect.toFixed(2)}</span>
                  <span className={sceneReport.anchored.matched === sceneReport.anchored.total ? 'text-emerald-600' : 'text-red-600'}>
                    {sceneReport.anchored.matched}/{sceneReport.anchored.total} anchors
                  </span>
                  {clip && <span>clip {clip.toFixed(1)}s</span>}
                </span>
              )}
            </div>

            {status && <p className="text-xs text-zinc-600">{status}</p>}

            {/* Where each shape actually lands, once the voice is real. */}
            {timing && (
              <div className="max-h-24 overflow-y-auto rounded-lg border border-zinc-200 p-2">
                {timing.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-[11px]">
                    <span className="w-14 shrink-0 font-mono text-zinc-400">{t.id}</span>
                    <span className={`w-14 shrink-0 text-right font-mono ${t.time === null ? 'text-red-600' : 'text-zinc-700'}`}>
                      {t.time === null ? 'unresolved' : `${t.time.toFixed(2)}s`}
                    </span>
                    <span className="relative h-1.5 min-w-0 flex-1 rounded bg-zinc-100">
                      {t.time !== null && clip && (
                        <span
                          className="absolute top-0 h-1.5 w-1 rounded bg-zinc-800"
                          style={{ left: `${Math.min(100, (t.time / clip) * 100)}%` }}
                        />
                      )}
                    </span>
                    <span className="w-52 shrink-0 truncate text-zinc-500">{t.anchor || '(by fraction)'}</span>
                  </div>
                ))}
              </div>
            )}

            {sceneReport && sceneReport.issues.length > 0 && (
              <ul className="max-h-28 overflow-y-auto text-xs">
                {sceneReport.issues.map((issue, i) => (
                  <li key={i} className={issue.severity === 'error' ? 'text-red-600' : 'text-amber-700'}>
                    {issue.shapeId && <span className="font-mono">{issue.shapeId}: </span>}
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

/** Every field of one shape, grouped so the common ones come first. */
function Inspector({
  shape,
  scene,
  onChange,
  onDuplicate,
  onRemove,
}: {
  shape: BoardShape
  scene: Scene
  onChange: (patch: Partial<BoardShape>) => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const isPoints = POINT_KINDS.has(shape.kind)
  const isChart = (CHART_KINDS as readonly string[]).includes(shape.kind)
  const others = scene.shapes.filter((s) => s.id !== shape.id)

  return (
    <div className="rounded-lg border border-zinc-200 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs text-zinc-500">{shape.id}</span>
        <span className="flex gap-1">
          <button onClick={onDuplicate} className="rounded border border-zinc-200 px-2 py-0.5 text-xs hover:bg-zinc-50">Duplicate</button>
          <button onClick={onRemove} className="rounded border border-zinc-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">Delete</button>
        </span>
      </div>

      <Row label="kind">
        <select value={shape.kind} onChange={(e) => onChange({ kind: e.target.value as BoardShape['kind'] })} className={input}>
          {SHAPE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </Row>

      <Row label="text">
        <textarea
          value={shape.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={2}
          className={`${input} resize-y font-normal`}
          placeholder={shape.kind === 'image' ? 'image search query' : 'label'}
        />
      </Row>

      <Row label="anchor">
        <input value={shape.anchor} onChange={(e) => onChange({ anchor: e.target.value })} className={`${input} ${shape.anchor && !scene.narration.includes(shape.anchor) ? 'border-red-400' : ''}`} placeholder="words from the narration" />
      </Row>

      <Row label="at">
        <span className="flex items-center gap-2">
          <input type="range" min={0} max={0.95} step={0.01} value={shape.at} onChange={(e) => onChange({ at: Number(e.target.value) })} className="flex-1" />
          <span className="w-10 text-right font-mono text-xs">{shape.at.toFixed(2)}</span>
        </span>
      </Row>

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {(['x', 'y', 'w', 'h'] as const).map((k) => (
          <label key={k} className="text-[10px] uppercase text-zinc-400">
            {k}
            <input type="number" value={shape[k]} onChange={(e) => onChange({ [k]: Number(e.target.value) })} className={input} />
          </label>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Select label="color" value={shape.color} options={COLORS} onChange={(v) => onChange({ color: v as BoardShape['color'] })} />
        <Select label="fill" value={shape.fill} options={FILLS} onChange={(v) => onChange({ fill: v as BoardShape['fill'] })} />
        <Select label="size" value={shape.size} options={SIZES} onChange={(v) => onChange({ size: v as BoardShape['size'] })} />
        <Select label="dash" value={shape.dash} options={DASHES} onChange={(v) => onChange({ dash: v as BoardShape['dash'] })} />
      </div>

      {(shape.kind === 'arrow' || shape.kind === 'elbow') && (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Select label="from" value={shape.from ?? ''} options={['', ...others.map((s) => s.id)]} onChange={(v) => onChange({ from: v || null })} />
          <Select label="to" value={shape.to ?? ''} options={['', ...others.map((s) => s.id)]} onChange={(v) => onChange({ to: v || null })} />
        </div>
      )}

      {isPoints && (
        <Row label="points">
          <textarea
            value={shape.points.map((p) => `${p.x},${p.y}`).join('\n')}
            onChange={(e) =>
              onChange({
                points: e.target.value
                  .split('\n')
                  .map((line) => line.split(',').map(Number))
                  .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
                  .map(([x, y]) => ({ x, y })),
              })
            }
            rows={3}
            className={`${input} font-mono`}
            placeholder="x,y per line"
          />
        </Row>
      )}

      {isChart && (
        <Row label="data">
          <textarea
            value={shape.data.map((d) => `${d.label},${d.value}`).join('\n')}
            onChange={(e) =>
              onChange({
                data: e.target.value
                  .split('\n')
                  .map((line) => {
                    const at = line.lastIndexOf(',')
                    return { label: line.slice(0, at).trim(), value: Number(line.slice(at + 1)) }
                  })
                  .filter((d) => d.label && Number.isFinite(d.value)),
              })
            }
            rows={3}
            className={`${input} font-mono`}
            placeholder="label,value per line"
          />
        </Row>
      )}
    </div>
  )
}

const input =
  'w-full rounded border border-zinc-200 px-1.5 py-1 text-xs outline-none focus:border-zinc-400'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-1.5 block">
      <span className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</span>
      {children}
    </label>
  )
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="text-[10px] uppercase text-zinc-400">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
        {options.map((o) => (
          <option key={o} value={o}>{o || '—'}</option>
        ))}
      </select>
    </label>
  )
}
