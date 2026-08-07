'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PLATES, PLATE_H, PLATE_W } from './docker-plates'
import { clamp, type Cue } from './ink'
import './demo.css'

/**
 * A nine-minute lesson, drawn to a recording.
 *
 * The whole thing is one function of `audio.currentTime`. There is no
 * scheduler, no queue and no per-scene state: a frame asks the clock where it
 * is, works out which plate that is and how far into it, and draws that. Which
 * is why scrubbing is free, and why nothing can drift out of step with the
 * voice — there is nothing to drift.
 */

interface Sheet {
  audio: string
  duration: number
  scenes: { n: number; start: number; end: number; beats: number[] }[]
}

/**
 * How long a beat takes to land.
 *
 * Beats are about three and a half seconds apart. At 1.15s the plate was
 * mid-draw a third of the time, so any given glance caught something
 * unfinished; at 0.62s it is settled for four fifths of every beat and the
 * drawing reads as *arriving* rather than as perpetually half-made.
 */
const REVEAL = 0.62

/** A plate with everything on it, for measuring the finished composition. */
const FULL: Cue = { p: 0.5, beat: 99, t: 4, at: () => 1 }

export default function DockerDemo() {
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [now, setNow] = useState(0)
  const [idle, setIdle] = useState(false)
  const [scale, setScale] = useState(1)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const idleTimer = useRef<number | null>(null)
  const measureRef = useRef<SVGGElement | null>(null)
  const [frame, setFrame] = useState<string>('')

  useEffect(() => {
    void fetch('/api/slate?name=docker-hood.cues.json')
      .then((r) => r.json())
      .then(setSheet)
      .catch(() => {})
  }, [])

  // The stage is a fixed field, scaled to the window: a composition placed at
  // 1600×900 is the composition everybody sees, on any screen.
  useEffect(() => {
    const fit = () =>
      setScale(Math.min(window.innerWidth / PLATE_W, window.innerHeight / PLATE_H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // One loop, reading the clock.
  useEffect(() => {
    if (!started) return
    let frame = 0
    const tick = () => {
      const audio = audioRef.current
      if (audio) setNow(audio.currentTime)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [started])

  // The chrome gets out of the way, and comes back when the mouse moves.
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

  /** Which plate, and where inside it. */
  const cue = useMemo<{ index: number; cue: Cue } | null>(() => {
    if (!sheet) return null
    const scenes = sheet.scenes
    let index = 0
    for (let i = 0; i < scenes.length; i++) if (now >= scenes[i].start) index = i
    const scene = scenes[index]
    const span = Math.max(0.001, scene.end - scene.start)

    let beat = 1
    for (const [i, at] of scene.beats.entries()) if (now >= at) beat = i + 1

    return {
      index,
      cue: {
        p: clamp((now - scene.start) / span),
        beat,
        t: Math.max(0, now - scene.start),
        at: (n, hold = 1) => {
          const start = scene.beats[n - 1]
          if (start == null) return 0
          return clamp((now - start) / (REVEAL / hold))
        },
      },
    }
  }, [sheet, now])

  /**
   * Fit each plate to the sheet.
   *
   * A composition authored at a comfortable size sits in a third of a 2560px
   * screen and reads as unfinished. Rather than hand-tune seventeen layouts to
   * one aspect ratio, the plate is rendered once fully revealed, measured, and
   * scaled to fill the field with an even margin — so every plate is as large
   * as it can be and the author only has to get the *arrangement* right.
   *
   * Measured off a hidden copy at full reveal, so the frame is the finished
   * composition's and does not creep as elements arrive.
   */
  const plateIndex = cue?.index ?? 0
  useEffect(() => {
    const node = measureRef.current
    if (!node) return
    const bounds = node.getBBox()
    if (!bounds.width || !bounds.height) return

    const margin = 96
    const zoom = Math.min(
      (PLATE_W - margin * 2) / bounds.width,
      (PLATE_H - margin * 2) / bounds.height,
      1.35
    )
    const cx = bounds.x + bounds.width / 2
    const cy = bounds.y + bounds.height / 2
    setFrame(
      `translate(${PLATE_W / 2} ${PLATE_H / 2}) scale(${zoom.toFixed(4)}) translate(${-cx} ${-cy})`
    )
  }, [plateIndex, sheet])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!started) return
      if (event.key === ' ') {
        event.preventDefault()
        toggle()
      }
      if (event.key === 'ArrowRight') seek(now + 10)
      if (event.key === 'ArrowLeft') seek(now - 10)
      if (event.key === 'ArrowDown' && sheet) {
        const next = sheet.scenes.find((s) => s.start > now + 0.4)
        if (next) seek(next.start)
      }
      if (event.key === 'ArrowUp' && sheet && cue) {
        const here = sheet.scenes[cue.index]
        seek(now - here.start < 1.2 ? (sheet.scenes[cue.index - 1]?.start ?? 0) : here.start)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [started, toggle, seek, now, sheet, cue])

  const plate = cue ? PLATES[Math.min(cue.index, PLATES.length - 1)] : null
  const duration = sheet?.duration ?? 1
  const clock = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <main className="plate">
      <div className="corner left">docker · under the hood</div>
      <div className="corner right">
        {plate ? `${String((cue?.index ?? 0) + 1).padStart(2, '0')} — ${plate.title}` : ''}
      </div>

      <div
        className="stage"
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
        onClick={started ? toggle : undefined}
      >
        <svg viewBox={`0 0 ${PLATE_W} ${PLATE_H}`} width={PLATE_W} height={PLATE_H}>
          {/* Measured, never seen: the same plate with every beat landed. */}
          <g ref={measureRef} opacity={0} aria-hidden style={{ pointerEvents: 'none' }}>
            {plate ? plate.render(FULL) : null}
          </g>
          <g transform={frame}>{plate && cue ? plate.render(cue.cue) : null}</g>
        </svg>
      </div>

      {/* Everything before the first stroke. */}
      <div className={`card${started ? ' gone' : ''}`}>
        <p className="micro" style={{ letterSpacing: '0.32em' }}>
          a drawn explainer · 9 minutes
        </p>
        <h1>What Docker actually does</h1>
        <p>
          Seventeen plates, drawn in time with the narration — namespaces, control groups,
          overlay file systems, the virtual cable, and the three programs that hand the job
          on before anything is started at all.
        </p>
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
        <span style={{ minWidth: 96, textAlign: 'right' }}>
          plate {String((cue?.index ?? 0) + 1).padStart(2, '0')}/17
        </span>
      </div>

      {sheet && (
        <audio
          ref={audioRef}
          src={sheet.audio}
          preload="auto"
          onEnded={() => setPlaying(false)}
        />
      )}
    </main>
  )
}
