'use client'

import type { ImageResult } from '@/app/api/image/route'
import type { BoardShape } from '@/lib/lesson'

/**
 * Renders one chart on the server and returns it as an image the board can
 * place, or null if it couldn't be drawn.
 *
 * Cached by the shape's data rather than its id, so the same chart drawn twice
 * in a lesson — or on replay — costs one request.
 */
const cache = new Map<string, Promise<ImageResult | null>>()

export function renderChart(shape: BoardShape): Promise<ImageResult | null> {
  const spec = {
    kind: shape.kind,
    title: shape.text ?? '',
    color: COLORS[shape.color] ?? COLORS.blue,
    data: shape.data,
  }

  const key = JSON.stringify(spec)
  const existing = cache.get(key)
  if (existing) return existing

  const pending = fetch('/api/chart', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(spec),
  })
    .then(async (response) => {
      if (!response.ok) {
        console.error('[chart]', (await response.json().catch(() => null))?.error)
        return null
      }
      const data = (await response.json()) as { url: string; width: number; height: number }
      return { src: data.url, width: data.width, height: data.height, source: '', animated: false }
    })
    .catch((error) => {
      console.error('[chart] request failed', error)
      return null
    })

  cache.set(key, pending)
  return pending
}

/** The board palette as hex, since the chart is drawn outside tldraw. */
const COLORS: Record<string, string> = {
  black: '#1d1d1d',
  grey: '#7a828e',
  blue: '#4263eb',
  'light-blue': '#4dabf7',
  green: '#099268',
  'light-green': '#40c057',
  red: '#e03131',
  'light-red': '#ff8787',
  orange: '#f76707',
  yellow: '#f0b429',
  violet: '#7048e8',
  'light-violet': '#b197fc',
}
