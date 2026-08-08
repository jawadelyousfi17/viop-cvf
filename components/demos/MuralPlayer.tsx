'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, EASINGS, Tldraw, type Editor, type TLShapeId } from 'tldraw'
import 'tldraw/tldraw.css'
import { setWallTheme, stationBounds, type Act, type CueSheet, type WallTheme } from './wall'
import { setCardTheme, type CardTheme } from './svg-cards'
import './demo.css'

/**
 * The Docker lesson, played onto a tldraw mural.
 *
 * The recording is the only clock. A sorted list of acts — each a shape
 * creation pinned to a second of audio — is walked forwards and backwards by
 * one pointer as the clock moves, so the board at any moment is a pure
 * function of `currentTime`: scrub anywhere and you get exactly the board that
 * moment always has.
 *
 * The camera is the storyteller. Each scene is a station on one big wall; the
 * camera travels between them as the narration moves on, and when the
 * recording ends it pulls back to show the whole mural — nine minutes of
 * drawing, all still there. Pause and the canvas is yours: tldraw shapes stay
 * real, so you can pan around and pick the diagrams up.
 */

/** How long a shape takes to arrive, in wall-clock ms. */
const ARRIVE = 380

export interface MuralProps {
  /** Cue-sheet filename under /examples, served by the slate route. */
  cue: string
  corner: string
  kicker: string
  title: string
  blurb: string
  build: (sheet: CueSheet) => Act[]
  /** Play only the first N scenes — a style sample rather than the lesson. */
  scenes?: number
  colorScheme?: 'light' | 'dark'
  grid?: boolean
  /** Extra class on the plate, for per-look chrome and canvas colours. */
  variant?: string
  wallTheme?: WallTheme
  cardTheme?: Partial<CardTheme>
}

export default function MuralPlayer(props: MuralProps) {
  const { cue, corner, kicker, title, blurb, build, scenes: sceneLimit } = props
  const [sheet, setSheet] = useState<CueSheet | null>(null)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [now, setNow] = useState(0)
  const [idle, setIdle] = useState(false)
  const [sceneIndex, setSceneIndex] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const actsRef = useRef<Act[]>([])
  /** Ids created by each applied act, parallel to the act list. */
  const appliedRef = useRef<TLShapeId[][]>([])
  const cursorRef = useRef(0)
  const tweensRef = useRef<{ id: TLShapeId; born: number }[]>([])
  const cameraKeyRef = useRef('')
  const idleTimer = useRef<number | null>(null)
  const doneRef = useRef(false)
  /** Per-scene camera frames, measured from the finished mural. */
  const framesRef = useRef<Box[]>([])

  useEffect(() => {
    void fetch(`/api/slate?name=${cue}`)
      .then((r) => r.json())
      .then((full: CueSheet) => {
        if (!sceneLimit) return setSheet(full)
        const kept = full.scenes.slice(0, sceneLimit)
        setSheet({ ...full, scenes: kept, duration: kept[kept.length - 1].end })
      })
      .catch(() => {})
  }, [cue, sceneLimit])

  /**
   * Builds the act list and measures each station's camera frame.
   *
   * The frame has to be the *finished* composition's — a camera aimed at the
   * empty half of a fixed station box shows dead paper until the shapes
   * arrive. So the whole mural is created once, invisibly, measured scene by
   * scene, and deleted again. Half a second of work at mount buys a camera
   * that always frames what the narration is about to draw.
   */
  const prepare = useCallback((editor: Editor, cueSheet: CueSheet) => {
    setWallTheme(props.wallTheme)
    setCardTheme(props.cardTheme)
    const acts = build(cueSheet)
    actsRef.current = acts

    const sceneOf = (at: number) => {
      let index = 0
      for (let i = 0; i < cueSheet.scenes.length; i++) {
        if (at >= cueSheet.scenes[i].start - 0.01) index = i
      }
      return index
    }
    const extents = cueSheet.scenes.map(() => ({
      minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity,
    }))
    const all: TLShapeId[] = []
    for (const act of acts) {
      const ids = act.make(editor)
      const extent = extents[sceneOf(act.at)]
      for (const id of ids) {
        all.push(id)
        if (act.focus) continue
        const b = editor.getShapePageBounds(id)
        if (!b) continue
        extent.minX = Math.min(extent.minX, b.x)
        extent.minY = Math.min(extent.minY, b.y)
        extent.maxX = Math.max(extent.maxX, b.x + b.w)
        extent.maxY = Math.max(extent.maxY, b.y + b.h)
      }
    }
    editor.deleteShapes(all)

    framesRef.current = extents.map((e, i) => {
      if (!Number.isFinite(e.minX)) {
        const f = stationBounds(i + 1)
        return new Box(f.x, f.y, f.w, f.h)
      }
      return new Box(e.minX - 50, e.minY - 50, e.maxX - e.minX + 100, e.maxY - e.minY + 100)
    })
    editor.zoomToBounds(framesRef.current[0], { inset: 60 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build, props.wallTheme, props.cardTheme])

  const onMount = useCallback((editor: Editor) => {
    editorRef.current = editor
    editor.user.updateUserPreferences({ colorScheme: props.colorScheme ?? 'light' })
    editor.updateInstanceState({ isGridMode: props.grid ?? true })
    if (sheet) prepare(editor, sheet)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, prepare])

  useEffect(() => {
    if (sheet && editorRef.current && actsRef.current.length === 0) {
      prepare(editorRef.current, sheet)
    }
  }, [sheet, prepare])

  /** Walks the act list to `t`, creating and deleting so the board matches. */
  const settle = useCallback((t: number) => {
    const editor = editorRef.current
    if (!editor) return
    const acts = actsRef.current
    const applied = appliedRef.current

    while (cursorRef.current < acts.length && acts[cursorRef.current].at <= t) {
      const ids = acts[cursorRef.current].make(editor)
      applied[cursorRef.current] = ids
      const born = performance.now()
      for (const id of ids) tweensRef.current.push({ id, born })
      cursorRef.current++
    }
    while (cursorRef.current > 0 && acts[cursorRef.current - 1].at > t) {
      cursorRef.current--
      const ids = applied[cursorRef.current] ?? []
      if (ids.length) editor.deleteShapes(ids)
      const gone = new Set(ids)
      tweensRef.current = tweensRef.current.filter((tw) => !gone.has(tw.id))
    }
  }, [])

  // When the recording ends, pull back and show the whole wall.
  const onEnded = useCallback(() => {
    setPlaying(false)
    const editor = editorRef.current
    if (!editor) return
    // The whole wall: the union of every station's own frame.
    const frames = framesRef.current
    if (!frames.length) return
    const minX = Math.min(...frames.map((f) => f.x))
    const minY = Math.min(...frames.map((f) => f.y))
    const maxX = Math.max(...frames.map((f) => f.x + f.w))
    const maxY = Math.max(...frames.map((f) => f.y + f.h))
    editor.zoomToBounds(new Box(minX, minY, maxX - minX, maxY - minY), {
      inset: 80,
      animation: { duration: 2800, easing: EASINGS.easeInOutCubic },
    })
  }, [])

  // One loop: clock → acts → arrivals → camera.
  useEffect(() => {
    if (!started) return
    let frame = 0
    const tick = () => {
      const editor = editorRef.current
      const audio = audioRef.current
      if (editor && audio && sheet) {
        const t = audio.currentTime
        setNow(t)
        settle(t)

        if (t >= sheet.duration - 0.05) {
          if (!doneRef.current) {
            doneRef.current = true
            audio.pause()
            setPlaying(false)
            onEnded()
          }
        } else {
          doneRef.current = false
        }

        // Arrivals: opacity eased in over a beat of wall-clock, so a shape is
        // never popped — and never half-there for long either.
        if (tweensRef.current.length) {
          const wall = performance.now()
          const still: typeof tweensRef.current = []
          for (const tw of tweensRef.current) {
            const k = Math.min(1, (wall - tw.born) / ARRIVE)
            const shape = editor.getShape(tw.id)
            if (shape) {
              editor.updateShape({ id: shape.id, type: shape.type, opacity: 1 - Math.pow(1 - k, 3) })
              if (k < 1) still.push(tw)
            }
          }
          tweensRef.current = still
        }

        // The camera follows the narration — station to station, except when
        // an act asks to be said full screen: then only its box is shown.
        let scene = 0
        for (let i = 0; i < sheet.scenes.length; i++) if (t >= sheet.scenes[i].start) scene = i
        setSceneIndex(scene)
        let key = `s${scene}`
        let target = framesRef.current[scene] ?? null
        const list = actsRef.current
        for (let i = 0; i < list.length; i++) {
          const f = list[i].focus
          if (f && t >= list[i].at && t < f.until) {
            key = `m${i}`
            target = new Box(f.x, f.y, f.w, f.h)
          }
        }
        if (key !== cameraKeyRef.current && target) {
          cameraKeyRef.current = key
          editor.zoomToBounds(target, {
            inset: 60,
            animation: { duration: 900, easing: EASINGS.easeInOutCubic },
          })
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [started, sheet, settle, onEnded])

  // The chrome gets out of the way while playing.
  useEffect(() => {
    const wake = () => {
      setIdle(false)
      if (idleTimer.current) window.clearTimeout(idleTimer.current)
      idleTimer.current = window.setTimeout(() => setIdle(true), 2600)
    }
    wake()
    window.addEventListener('mousemove', wake)
    window.addEventListener('keydown', wake)
    return () => {
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('keydown', wake)
      if (idleTimer.current) window.clearTimeout(idleTimer.current)
    }
  }, [])

  const begin = useCallback(() => {
    setStarted(true)
    const audio = audioRef.current
    if (!audio) return
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }, [])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play().then(() => setPlaying(true)).catch(() => {})
    else {
      audio.pause()
      setPlaying(false)
    }
  }, [])

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, seconds))
    setNow(audio.currentTime)
  }, [])

  /** Jump to the next section's first beat. */
  const nextScene = useCallback(() => {
    if (!sheet) return
    const next = sheet.scenes.find((s) => s.start > now + 0.4)
    if (next) seek(next.start)
  }, [sheet, now, seek])

  /** Back to the top of this section — or the one before, if already there. */
  const prevScene = useCallback(() => {
    if (!sheet) return
    const here = sheet.scenes[sceneIndex]
    if (!here) return
    seek(now - here.start < 1.2 ? (sheet.scenes[sceneIndex - 1]?.start ?? 0) : here.start)
  }, [sheet, now, sceneIndex, seek])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!started) return
      if (event.key === ' ') {
        event.preventDefault()
        toggle()
      }
      if (event.key === 'ArrowRight') seek(now + 10)
      if (event.key === 'ArrowLeft') seek(now - 10)
      if (event.key === 'ArrowDown') nextScene()
      if (event.key === 'ArrowUp') prevScene()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [started, toggle, seek, now, nextScene, prevScene])

  const duration = sheet?.duration ?? 1
  const clock = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  return (
    <main className={`plate bare${props.variant ? ` ${props.variant}` : ''}`}>
      <div className="canvas">
        <Tldraw hideUi onMount={onMount} />
      </div>

      <div className="corner left">{corner}</div>

      <div className={`card${started ? ' gone' : ''}`}>
        <p className="micro" style={{ letterSpacing: '0.32em' }}>
          {kicker}
        </p>
        <h1>{title}</h1>
        <p>{blurb}</p>
        <button type="button" className="begin" onClick={begin} disabled={!sheet}>
          {sheet ? 'Begin' : 'Loading'}
        </button>
      </div>

      <div className={`runner${idle && playing ? ' away' : ''}`}>
        <button type="button" className="key" onClick={toggle}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <span style={{ minWidth: 74 }}>{clock(now)}</span>
        <div
          className="track"
          onClick={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect()
            seek(((event.clientX - bounds.left) / bounds.width) * duration)
          }}
        >
          <div className="done" style={{ width: `${(now / duration) * 100}%` }} />
          {sheet?.scenes.map((s) => (
            <div key={s.n} className="tick" style={{ left: `${(s.start / duration) * 100}%` }} />
          ))}
        </div>
        <span style={{ minWidth: 74, textAlign: 'right' }}>{clock(duration)}</span>
        <button type="button" className="key" onClick={prevScene} aria-label="previous section">
          ↑
        </button>
        <span style={{ minWidth: 74, textAlign: 'center' }}>
          {String(sceneIndex + 1).padStart(2, '0')}/{sheet?.scenes.length ?? 0}
        </span>
        <button type="button" className="key" onClick={nextScene} aria-label="next section">
          ↓
        </button>
      </div>

      {sheet && (
        <audio ref={audioRef} src={sheet.audio} preload="auto" onEnded={onEnded} />
      )}
    </main>
  )
}
