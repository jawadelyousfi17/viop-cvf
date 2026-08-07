'use client'

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import {
  FadeIn,
  LEFT,
  Line,
  MathTex,
  Scene,
  SurroundingRectangle,
  Text,
  TransformMatchingTex,
  Write,
  type Mobject,
} from 'manim-web'
import {
  COLUMN_X,
  FRAME_H,
  FRAME_W,
  INK,
  PAPER,
  PAGE_TOP,
  RULE,
  pageOffset,
  placeSteps,
  type MathScene,
  type PlacedStep,
} from '@/lib/math-lesson'

export interface NotebookHandle {
  /**
   * Puts a page up and starts working down it. The schedule is held by
   * reference and re-read as the page plays, so the player can correct it in
   * place once the real voiceover timing lands.
   */
  setScene: (scene: MathScene, schedule: Map<string, number>) => void
  /** Where the voice has reached, in seconds into this page. */
  setTime: (seconds: number) => void
  setPlaying: (playing: boolean) => void
}

/**
 * A clock the page waits on.
 *
 * Manim drives itself — `await play(...)`, then the next thing. Here the voice
 * leads: each line of working blocks until the narration reaches the words it
 * belongs to. Waiters resolve rather than reject when a page is torn off, so
 * the loop unwinds cleanly instead of parking forever on a moment that will
 * never come.
 */
class Clock {
  private now = 0
  /**
   * `at` is a getter rather than a number because the schedule is re-timed when
   * the audio arrives, seconds after the page started on an estimate. Reading
   * it each tick means a line already waiting picks up its corrected moment.
   */
  private waiters: { at: () => number; resolve: () => void }[] = []
  private stopped = false

  set(seconds: number) {
    this.now = seconds
    if (!this.waiters.length) return
    const due = this.waiters.filter((waiter) => waiter.at() <= seconds)
    if (!due.length) return
    this.waiters = this.waiters.filter((waiter) => waiter.at() > seconds)
    for (const waiter of due) waiter.resolve()
  }

  until(at: () => number): Promise<void> {
    if (this.stopped || at() <= this.now) return Promise.resolve()
    return new Promise((resolve) => this.waiters.push({ at, resolve }))
  }

  stop() {
    this.stopped = true
    for (const waiter of this.waiters) waiter.resolve()
    this.waiters = []
  }

  get cancelled() {
    return this.stopped
  }
}

/** Ruled paper, drawn once behind everything. */
function ruling(scene: Scene, offset: number) {
  const lines: Mobject[] = []
  for (let y = PAGE_TOP + 0.6; y > PAGE_TOP - offset - FRAME_H; y -= 1.15) {
    lines.push(
      new Line({
        start: [-FRAME_W / 2, y, 0],
        end: [FRAME_W / 2, y, 0],
        color: RULE,
        strokeWidth: 1.4,
      })
    )
  }
  // The margin rule every exercise book has, and the reason the working starts
  // where it does.
  lines.push(
    new Line({
      start: [COLUMN_X - 0.55, PAGE_TOP + 1.4, 0],
      end: [COLUMN_X - 0.55, PAGE_TOP - offset - FRAME_H, 0],
      color: '#e8b4b8',
      strokeWidth: 1.6,
    })
  )
  scene.add(...lines)
  return lines
}

/** The mobject a step becomes. Null for the kinds that only act on another. */
function build(step: PlacedStep): Mobject | null {
  const color = INK[step.color]

  if (step.kind === 'note') {
    return new Text({ text: step.tex, color: INK.grey, fontSize: 26 }).moveTo(
      [step.x, step.y, 0],
      LEFT
    )
  }
  if (step.kind === 'label') {
    return new Text({ text: step.tex, color, fontSize: 30 }).moveTo([step.x, step.y, 0], LEFT)
  }
  if (step.kind === 'rule') {
    return new Line({
      start: [step.x, step.y, 0],
      end: [step.x + 6.4, step.y, 0],
      color: INK.grey,
      strokeWidth: 2,
    })
  }

  // Everything else is maths. Aligned to the left of the column rather than
  // centred on it, because a page of working is read down its left edge.
  return new MathTex({ latex: step.tex, color, fontSize: step.scale * 1.15 }).moveTo(
    [step.x, step.y, 0],
    LEFT
  )
}

export default function Notebook({ ref, onReady }: { ref: Ref<NotebookHandle>; onReady?: () => void }) {
  const holdRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const clockRef = useRef<Clock | null>(null)
  const runRef = useRef(0)

  useImperativeHandle(ref, () => ({
    setScene(spec, schedule) {
      const hold = holdRef.current
      if (!hold) return

      // Stop the page that was playing before starting another, or two loops
      // share one canvas and fight over every frame.
      clockRef.current?.stop()
      sceneRef.current?.dispose()

      const run = ++runRef.current
      const clock = new Clock()
      const scene = new Scene(hold, {
        backgroundColor: PAPER,
        frameWidth: FRAME_W,
        frameHeight: FRAME_H,
      })
      clockRef.current = clock
      sceneRef.current = scene

      const steps = placeSteps(spec)
      const deepest = steps.reduce((low, step) => Math.min(low, step.y), PAGE_TOP)
      ruling(scene, Math.max(0, PAGE_TOP - deepest))

      void (async () => {
        const drawn = new Map<string, Mobject>()
        let scrolled = 0

        for (const step of steps) {
          await clock.until(() => schedule.get(step.id) ?? 0)
          if (clock.cancelled || runRef.current !== run) return

          // Follow the pen down the page, a page at a time.
          const wanted = pageOffset(step)
          if (wanted !== scrolled) {
            scrolled = wanted
            scene.camera.position.set(0, -wanted, scene.camera.position.z)
          }

          if (step.kind === 'mark') {
            const target = step.from ? drawn.get(step.from) : undefined
            if (!target) continue
            await scene.play(
              new FadeIn(new SurroundingRectangle(target, { color: INK[step.color], buff: 0.18 }))
            )
            continue
          }

          const made = build(step)
          if (!made) continue

          const previous = step.from ? drawn.get(step.from) : undefined
          // Only maths can be matched against maths — TransformMatchingTex
          // pairs up glyphs, and there is nothing to pair in a margin note.
          if (step.kind === 'rewrite' && previous instanceof MathTex && made instanceof MathTex) {
            // The whole point of a worked solution: the terms that survive stay
            // where they are and only what changed moves.
            await scene.play(new TransformMatchingTex(previous, made))
            drawn.delete(step.from!)
          } else if (step.kind === 'note' || step.kind === 'rule') {
            await scene.play(new FadeIn(made))
          } else {
            await scene.play(new Write(made))
          }
          drawn.set(step.id, made)
        }
      })().catch(() => {
        // A page that fails to draw is a page that stays as it was. The voice
        // carries on either way, and a thrown LaTeX error should not take the
        // lesson down with it.
      })
    },
    setTime(seconds) {
      clockRef.current?.set(seconds)
    },
    setPlaying(playing) {
      const scene = sceneRef.current
      if (!scene) return
      if (playing) scene.resume()
      else scene.pause()
    },
  }))

  useEffect(() => {
    onReady?.()
    return () => {
      clockRef.current?.stop()
      sceneRef.current?.dispose()
    }
  }, [onReady])

  return <div ref={holdRef} className="absolute inset-0" />
}
