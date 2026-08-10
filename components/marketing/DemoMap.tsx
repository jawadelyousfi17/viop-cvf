'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { mindmapToScene, type MindMap } from '@/lib/mindmap'
import { BoardCanvas } from '../engine/BoardCanvas'
import { ImageBank } from '../images'

/**
 * A real map, on the landing page.
 *
 * Drawn by the same renderer the product uses, from a tree written by hand
 * here. The alternative was a screenshot, which goes stale the first time the
 * layout changes and is nobody's job to retake — this cannot drift, because if
 * the board stops looking like this then the board has changed.
 *
 * It shows the claim rather than restating it: three levels, a leaf carrying a
 * real sentence instead of a label, and a symbol beside each limb. Someone who
 * reads no further has still seen what they would get.
 */

const DEMO: MindMap = {
  heading: 'How a cache stays fast',
  root: {
    text: 'How a cache stays fast',
    children: [
      {
        text: 'Locality',
        symbol: 'magnet',
        children: [
          { text: 'Reuse the same address', children: [] },
          {
            text: 'Neighbours arrive too',
            detail:
              'Memory is fetched a line at a time, about sixty-four bytes, so the bytes beside the one you asked for are already there.',
            children: [],
          },
        ],
      },
      {
        text: 'A hierarchy',
        symbol: 'staircase',
        children: [
          { text: 'L1 · about a nanosecond', children: [] },
          { text: 'Main memory · about a hundred', children: [] },
        ],
      },
      {
        text: 'What it costs',
        symbol: 'hourglass',
        children: [
          {
            text: 'A miss pays the long trip',
            detail:
              'Ninety-five hits in a hundred is what keeps the average near L1. The other five pay for all of it.',
            children: [],
          },
        ],
      },
    ],
  },
}

export function DemoMap({ className = '' }: { className?: string }) {
  const scene = useMemo(() => mindmapToScene(DEMO), [])
  const [symbols, setSymbols] = useState<Map<string, string>>(new Map())
  const bankRef = useRef<ImageBank | null>(null)

  // The symbols are drawn to order and cached on disk for ever, so this costs
  // a handful of calls once and nothing on every visit after.
  useEffect(() => {
    if (!scene) return
    const bank = (bankRef.current ??= new ImageBank())

    let cancelled = false
    for (const shape of scene.shapes) {
      if (shape.kind !== 'symbol' || !shape.text.trim()) continue
      const query = shape.text.trim().toLowerCase()
      void bank.get(shape.text, 'symbol').then((found) => {
        if (cancelled || !found) return
        setSymbols((current) =>
          current.get(query) === found.src ? current : new Map(current).set(query, found.src)
        )
      })
    }
    return () => {
      cancelled = true
    }
  }, [scene])

  if (!scene) return null

  return (
    // Inert on purpose. The board takes the wheel over itself so a map can be
    // panned without the page moving underneath it — correct in the app, and
    // a scroll trap on a page someone is trying to read past.
    <div className={`pointer-events-none select-none ${className}`} aria-hidden>
      <BoardCanvas shapes={scene.shapes} symbols={symbols} view={{ type: 'fit' }} className="size-full" />
    </div>
  )
}
