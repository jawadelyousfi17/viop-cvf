'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { BoardShape } from '@/lib/lesson'
import { BoardCanvas } from '../engine/BoardCanvas'

/**
 * The product, running, above the fold.
 *
 * Not a recorded video. A video of a whiteboard is a file to host, a codec to
 * argue with, a poster frame, and a thing that goes stale the day the boards
 * change — and it would be a picture of the engine rather than the engine. This
 * is the real renderer drawing a real board, one shape at a time, with the line
 * that is "spoken" underneath. What you see here is what the app draws.
 *
 * Silent, and looping. Sound on a landing page is hostile and browsers block it
 * anyway; the caption carries what the voice would say.
 */

/** One beat: what is said, and what appears while it is being said. */
const BEATS: { say: string; shapes: BoardShape[] }[] = [
  {
    say: 'Your processor does something every third of a nanosecond.',
    shapes: [
      shape({
        id: 'cpu',
        kind: 'box',
        text: 'PROCESSOR\n0.3 ns per step',
        x: 60,
        y: 90,
        w: 360,
        h: 140,
        color: 'light-blue',
        fill: 'semi',
        size: 'm',
      }),
    ],
  },
  {
    say: 'Main memory takes about a hundred nanoseconds to answer.',
    shapes: [
      shape({
        id: 'ram',
        kind: 'box',
        text: 'MAIN MEMORY\n100 ns per fetch',
        x: 700,
        y: 90,
        w: 360,
        h: 140,
        color: 'yellow',
        fill: 'semi',
        size: 'm',
      }),
    ],
  },
  {
    say: 'So in the time one value comes back, the core could have finished three hundred more steps.',
    shapes: [
      shape({
        id: 'link',
        kind: 'arrow',
        text: '',
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        from: 'cpu',
        to: 'ram',
        color: 'red',
      }),
      shape({
        id: 'ratio',
        kind: 'text',
        text: '300×',
        x: 470,
        y: 230,
        w: 200,
        h: 90,
        size: 'xl',
        color: 'red',
      }),
    ],
  },
  {
    say: 'It is not slow because it is thinking. It is waiting.',
    shapes: [
      shape({
        id: 'note',
        kind: 'label',
        text: 'this gap is the whole problem',
        x: 380,
        y: 330,
        w: 380,
        h: 70,
        color: 'red',
        size: 's',
      }),
    ],
  },
]

/** Where the finished board sits, so the camera never lurches mid-draw. */
const FRAME = { x: 40, y: 60, w: 1040, h: 370 }

const BEAT_MS = 2200
/** A moment on the finished board before it starts again. */
const HOLD_MS = 2600

export function BoardDemo({ className = '' }: { className?: string }) {
  const [beat, setBeat] = useState(0)
  const host = useRef<HTMLDivElement>(null)
  const [live, setLive] = useState(false)

  // Nothing animates until it is on screen: a demo drawing itself at the foot
  // of a page nobody has scrolled to is work done for no one.
  useEffect(() => {
    const element = host.current
    if (!element) return

    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          setLive(false)
          return
        }
        // Someone who has asked for less motion gets the finished board rather
        // than nothing: the point is what it draws, not the drawing of it.
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          setBeat(BEATS.length)
          setLive(false)
          return
        }
        setLive(true)
      },
      { threshold: 0.35 }
    )
    watcher.observe(element)
    return () => watcher.disconnect()
  }, [])

  useEffect(() => {
    if (!live) return
    const done = beat >= BEATS.length
    const timer = setTimeout(() => setBeat(done ? 0 : beat + 1), done ? HOLD_MS : BEAT_MS)
    return () => clearTimeout(timer)
  }, [live, beat])

  const shapes = useMemo(
    () => BEATS.slice(0, Math.min(beat, BEATS.length - 1) + 1).flatMap((step) => step.shapes),
    [beat]
  )
  const view = useMemo(() => ({ type: 'fit' as const }), [])
  const caption = BEATS[Math.min(beat, BEATS.length - 1)].say

  return (
    <div ref={host} className={`flex flex-col bg-white ${className}`}>
      {/* Not interactive: this is a demonstration, and a board that pans under
          the cursor on a landing page is a board people get stuck in. */}
      <div className="pointer-events-none relative flex-1">
        <BoardCanvas shapes={shapes} frame={FRAME} view={view} className="absolute inset-0" />
      </div>

      {/* What the voice is saying, since the voice itself is not playing. */}
      <p className="flex min-h-[68px] items-center gap-2.5 border-t border-zinc-100 px-6 py-4 text-[15px] leading-snug text-zinc-500">
        <span className="inline-block size-2 shrink-0 rounded-full bg-emerald-500" />
        {caption}
      </p>
    </div>
  )
}

/** The board language's defaults, so a demo shape only says what differs. */
function shape(partial: Partial<BoardShape> & { id: string; kind: BoardShape['kind'] }): BoardShape {
  return {
    text: '',
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    from: null,
    to: null,
    color: 'black',
    fill: 'none',
    size: 'm',
    dash: 'draw',
    at: 0,
    anchor: '',
    points: [],
    data: [],
    parent: null,
    ...partial,
  }
}
