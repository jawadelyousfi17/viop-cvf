'use client'

import type { ImageResult } from '@/app/api/image/route'

/**
 * Looks up and caches one image per search query.
 *
 * Lookups start when a scene begins, in parallel with the voiceover, so the
 * picture is usually decoded by the time the narration reaches it. A miss is
 * not an error — the painter draws a labelled placeholder instead.
 */
export class ImageBank {
  private readonly cache = new Map<string, Promise<ImageResult | null>>()
  /** Flips to false after a 501, so we stop asking when no key is configured. */
  private enabled = true

  get(query: string): Promise<ImageResult | null> {
    const key = query.trim().toLowerCase()
    if (!key) return Promise.resolve(null)

    const existing = this.cache.get(key)
    if (existing) return existing

    const pending = this.load(query)
    this.cache.set(key, pending)
    return pending
  }

  /** Kicks off every image lookup a scene will need, all at once. */
  prefetch(queries: string[]) {
    for (const query of queries) void this.get(query).catch(() => null)
  }

  private async load(query: string): Promise<ImageResult | null> {
    if (!this.enabled) return null

    try {
      const response = await fetch(`/api/image?q=${encodeURIComponent(query)}`)
      if (response.status === 501) {
        this.enabled = false
        return null
      }
      if (!response.ok) return null

      const result = (await response.json()) as ImageResult
      if (!result?.src) return null

      // Decode before handing it to the canvas so the shape doesn't pop in
      // blank and then fill.
      await preload(result.src)
      return result
    } catch {
      return null
    }
  }
}

function preload(src: string) {
  return new Promise<void>((resolve) => {
    const image = new Image()
    const done = () => resolve()
    image.onload = done
    image.onerror = done
    image.src = src
    // Never block a scene on a slow host.
    setTimeout(done, 6000)
  })
}
