'use client'

import type { ImageResult } from '@/app/api/image/route'

/** A photograph, searched for; or a symbol, drawn to order. */
type Kind = 'image' | 'symbol'

const GIVE_UP_AFTER: Record<Kind, number> = { image: 3, symbol: 6 }

/**
 * Looks up and caches one image per search query.
 *
 * Lookups start when a scene begins, in parallel with the voiceover, so the
 * picture is usually decoded by the time the narration reaches it. A miss is
 * not an error — the painter draws a labelled placeholder instead.
 */
export class ImageBank {
  private readonly cache = new Map<string, Promise<ImageResult | null>>()
  /**
   * Kept per kind, because the two are different services behind different
   * keys: photographs come from an image search, symbols are drawn by a model.
   * Shared, one missing key or one spent quota silently took the other down
   * with it — and a board is now mostly symbols, so that trade is the wrong way
   * round.
   */
  private readonly enabled: Record<Kind, boolean> = { image: true, symbol: true }
  /**
   * Consecutive hard failures, again per kind. A spent quota fails every lookup
   * in the lesson, a dozen round trips per scene, so give up after a few in a
   * row — but not on the first, since one dead host shouldn't cost the rest of
   * the pictures. Symbols are drawn one model call at a time and a single call
   * can fail on its own, so they get a longer rope than a search does.
   */
  private readonly failures: Record<Kind, number> = { image: 0, symbol: 0 }

  /**
   * @param kind `symbol` has the line art drawn to order by a model rather than
   *   searching the photo index. Cached under the same key space, since a scene
   *   never asks for both a photograph and a symbol of the same phrase.
   */
  get(query: string, kind: Kind = 'image'): Promise<ImageResult | null> {
    const key = query.trim().toLowerCase()
    if (!key) return Promise.resolve(null)

    const existing = this.cache.get(key)
    if (existing) return existing

    const pending = this.load(query, kind)
    this.cache.set(key, pending)
    return pending
  }

  /** Kicks off every lookup a scene will need, all at once. */
  prefetch(queries: { query: string; kind: Kind }[] | string[]) {
    for (const entry of queries) {
      if (typeof entry === 'string') void this.get(entry).catch(() => null)
      else void this.get(entry.query, entry.kind).catch(() => null)
    }
  }

  private async load(query: string, kind: Kind = 'image'): Promise<ImageResult | null> {
    if (!this.enabled[kind]) return null

    try {
      const endpoint = kind === 'symbol' ? '/api/icon' : '/api/image'
      const response = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`)
      if (response.status === 501) {
        this.enabled[kind] = false
        return null
      }
      // A 404 is just "nothing suitable for this query" — it says nothing
      // about the next one. Only server-side failures count against us.
      if (response.status >= 500) {
        if (++this.failures[kind] >= GIVE_UP_AFTER[kind]) {
          this.enabled[kind] = false
          console.warn(`[images] ${kind} lookups keep failing — see /api/image/test`)
        }
        return null
      }
      if (!response.ok) return null

      const result = (await response.json()) as ImageResult
      if (!result?.src) return null
      this.failures[kind] = 0

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
