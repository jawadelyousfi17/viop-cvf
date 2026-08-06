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
  /**
   * Consecutive hard failures. A spent quota fails every lookup in the lesson,
   * a dozen round trips per scene, so give up after a few in a row — but not on
   * the first, since one dead host shouldn't cost the rest of the pictures.
   */
  private failures = 0

  /**
   * @param kind `symbol` looks in The Noun Project for a line-art glyph rather
   *   than in the photo search. Cached under the same key space, since a scene
   *   never asks for both a photograph and a symbol of the same phrase.
   */
  get(query: string, kind: 'image' | 'symbol' = 'image'): Promise<ImageResult | null> {
    const key = query.trim().toLowerCase()
    if (!key) return Promise.resolve(null)

    const existing = this.cache.get(key)
    if (existing) return existing

    const pending = this.load(query, kind)
    this.cache.set(key, pending)
    return pending
  }

  /** Kicks off every lookup a scene will need, all at once. */
  prefetch(queries: { query: string; kind: 'image' | 'symbol' }[] | string[]) {
    for (const entry of queries) {
      if (typeof entry === 'string') void this.get(entry).catch(() => null)
      else void this.get(entry.query, entry.kind).catch(() => null)
    }
  }

  private async load(query: string, kind: 'image' | 'symbol' = 'image'): Promise<ImageResult | null> {
    if (!this.enabled) return null

    try {
      const endpoint = kind === 'symbol' ? '/api/icon' : '/api/image'
      const response = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`)
      if (response.status === 501) {
        this.enabled = false
        return null
      }
      // A 404 is just "nothing suitable for this query" — it says nothing
      // about the next one. Only server-side failures count against us.
      if (response.status >= 500) {
        if (++this.failures >= 3) {
          this.enabled = false
          console.warn('[images] search keeps failing — see /api/image/test')
        }
        return null
      }
      if (!response.ok) return null

      const result = (await response.json()) as ImageResult
      if (!result?.src) return null
      this.failures = 0

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
