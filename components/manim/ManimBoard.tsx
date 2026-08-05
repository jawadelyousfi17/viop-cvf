'use client'

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { AnimationGroup, Scene } from 'manim-ts'
import type { ManimScene } from '@/lib/manim-lesson'
import { buildAnimations, buildScene } from './build'

export interface ManimBoardHandle {
  /**
   * Plays a scene, gating each step on the narration clock. The schedule map is
   * held by reference and re-read as the scene plays, so the player can correct
   * it in place when the real voiceover timing arrives.
   */
  setScene: (scene: ManimScene, schedule: Map<string, number>) => void
  /** Where the voice has reached, in seconds into the current scene. */
  setTime: (seconds: number) => void
  /** Freezes mid-animation without losing the scene. */
  setPlaying: (playing: boolean) => void
}

/**
 * A clock the scene's `construct()` can wait on.
 *
 * manim drives itself: `await this.play(...)` runs a step and moves on. Here the
 * voice leads, so each step blocks until the narration reaches the phrase it
 * illustrates. Waiters are resolved rather than rejected on dispose, so a scene
 * change unwinds `construct` cleanly instead of leaving it parked forever on a
 * moment that will never arrive.
 */
class Clock {
  private now = 0
  /**
   * `at` is a getter, not a number, because the schedule is re-timed once the
   * real audio lands — several seconds after the scene started on an estimate.
   * Re-reading it each tick means a step already waiting picks up its corrected
   * moment instead of firing on a stale guess.
   */
  private waiters: { at: () => number; resolve: () => void }[] = []
  private disposed = false

  set(seconds: number) {
    this.now = seconds
    if (!this.waiters.length) return
    const due = this.waiters.filter((w) => w.at() <= seconds)
    if (!due.length) return
    this.waiters = this.waiters.filter((w) => w.at() > seconds)
    for (const waiter of due) waiter.resolve()
  }

  until(at: () => number): Promise<void> {
    if (this.disposed || at() <= this.now) return Promise.resolve()
    return new Promise((resolve) => this.waiters.push({ at, resolve }))
  }

  dispose() {
    this.disposed = true
    for (const waiter of this.waiters) waiter.resolve()
    this.waiters = []
  }

  get cancelled() {
    return this.disposed
  }
}

/** A manim scene whose steps are released by the narration rather than by time. */
class LessonScene extends Scene {
  constructor(
    private readonly spec: ManimScene,
    private readonly schedule: Map<string, number>,
    private readonly clock: Clock
  ) {
    super()
  }

  async construct() {
    const { mobjects, initial } = buildScene(this.spec)
    // The static diagram the animated parts happen on top of.
    if (initial.length) this.add(...initial)

    for (const step of this.spec.steps) {
      await this.clock.until(() => this.schedule.get(step.id) ?? 0)
      if (this.clock.cancelled) return

      if (step.action === 'wait') {
        await this.wait(step.runTime)
        continue
      }

      const animations = buildAnimations(step, mobjects)
      if (!animations.length) continue

      await this.play(
        animations.length === 1
          ? animations[0]
          : new AnimationGroup(animations, { lagRatio: step.lag, runTime: step.runTime })
      )
    }
  }
}

export default function ManimBoard({
  ref,
  onReady,
}: {
  ref: Ref<ManimBoardHandle>
  /**
   * Fired once the canvas exists. The board is loaded dynamically, so it mounts
   * after the player's scene effect has run — without this the first scene is
   * never handed over and the board stays black.
   */
  onReady?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<LessonScene | null>(null)
  const clockRef = useRef<Clock | null>(null)

  useImperativeHandle(ref, () => ({
    setScene(spec, schedule) {
      const canvas = canvasRef.current
      if (!canvas) return

      // Stop the outgoing scene's animation loop before starting another, or
      // two render loops share one canvas and fight over every frame.
      sceneRef.current?.abort()
      clockRef.current?.dispose()

      const clock = new Clock()
      const scene = new LessonScene(spec, schedule, clock)
      clockRef.current = clock
      sceneRef.current = scene
      void scene.render(canvas)
    },
    setTime(seconds) {
      clockRef.current?.set(seconds)
    },
    setPlaying(playing) {
      // manim scales its own frame delta, so zero freezes an animation
      // mid-flight and playback resumes exactly where it stopped.
      if (sceneRef.current) sceneRef.current.speed = playing ? 1 : 0
    },
  }))

  useEffect(() => {
    onReady?.()
    return () => {
      sceneRef.current?.abort()
      clockRef.current?.dispose()
    }
  }, [onReady])

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
}
