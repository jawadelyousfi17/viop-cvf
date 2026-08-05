'use client'

import type { ManimScene } from '@/lib/manim-lesson'
import type { Narration } from '../narrator'

/** Where a step fires, resolved against the real voiceover. */
export function scheduleFor(scene: ManimScene, narration: Narration) {
  const schedule: Record<string, number> = {}
  for (const step of scene.steps) {
    const anchored = step.anchor ? narration.timeOf(step.anchor) : null
    schedule[step.id] = anchored ?? step.at * narration.duration
  }
  return schedule
}

/**
 * Renders scenes to video on the server, one request per scene, cached.
 *
 * A rendered video can't wait for the voice the way the browser renderer does,
 * so the timing is baked in — which means a scene can only be rendered once its
 * narration exists. That puts a real cost on the first scene, so every render
 * is started as early as it possibly can be and kept here by index: the
 * moment scene N starts playing, N+1 is already rendering.
 */
export class RenderBank {
  private readonly cache = new Map<number, Promise<string | null>>()
  private available: Promise<boolean> | null = null

  /** Whether the server has manim at all. Asked once. */
  canRender(): Promise<boolean> {
    this.available ??= fetch('/api/render')
      .then((response) => (response.ok ? response.json() : { available: false }))
      .then((data: { available?: boolean; hint?: string }) => {
        if (!data.available && data.hint) console.info('[manim]', data.hint)
        return Boolean(data.available)
      })
      .catch(() => false)
    return this.available
  }

  get(index: number, scene: ManimScene, narration: Narration): Promise<string | null> {
    const existing = this.cache.get(index)
    if (existing) return existing

    const pending = this.render(scene, narration)
    this.cache.set(index, pending)
    return pending
  }

  private async render(scene: ManimScene, narration: Narration): Promise<string | null> {
    if (!(await this.canRender())) return null

    try {
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scene,
          schedule: scheduleFor(scene, narration),
          duration: narration.duration,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        // The traceback is the only useful thing when a scene won't build.
        console.error('[manim] render failed', data?.detail ?? data?.error)
        return null
      }
      return data.url as string
    } catch (error) {
      console.error('[manim] render request failed', error)
      return null
    }
  }

  /** Drops everything, so a new lesson doesn't play the old one's video. */
  clear() {
    this.cache.clear()
  }
}
