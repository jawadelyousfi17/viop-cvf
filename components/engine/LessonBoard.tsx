'use client'

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { SCENE_GAP, SCENE_H, SCENE_W, type BoardShape } from '@/lib/lesson'
import { chartKey } from '@/lib/chart'
import { BoardCanvas, type View } from './BoardCanvas'
import { expandComposite, isComposite } from './figures'

/**
 * The lesson board, drawn by this engine instead of by tldraw.
 *
 * tldraw needs a licence to run in production, which is a fine reason to stop
 * using it and no reason at all to rewrite the player: the studio already
 * spoke to the board through five methods — reset, focus, connect, paint,
 * addImage — and everything hard about a narrated lesson (the clock, the
 * voice, the ordering, the image bank) lives on the studio's side of that
 * line. So this is the same five methods over React state. The player did not
 * have to change to use it, and the tldraw painter is still in the repo,
 * unused, if that decision ever reverses.
 *
 * The one real difference is which way the data flows. A painter *commands* an
 * editor: make this shape, now this one. A React board is a function of state,
 * so `paint` appends to a list and the board redraws. That is why nothing here
 * queues, retries or reconciles — the second render of a shape is the same
 * shape, and drawing it twice is free.
 */

export interface Picture {
  src: string
  width: number
  height: number
  animated?: boolean
}

/**
 * What the player is allowed to ask the board for.
 *
 * Deliberately the same shape as the tldraw painter's public surface, so the
 * two are swappable and the studio does not know which one it has.
 */
export interface LessonPainter {
  has(sceneIndex: number, shapeId: string): boolean
  reset(): void
  focus(sceneIndex: number, shapes?: BoardShape[]): void
  connect(fromScene: number): void
  paint(sceneIndex: number, shape: BoardShape, scene: BoardShape[], animate?: boolean): void
  addImage(key: string, found: Picture): void
}

/** Scenes stack downward, so the lesson scrolls like one long page. */
export const sceneOffsetY = (sceneIndex: number) => sceneIndex * (SCENE_H + SCENE_GAP)

/** Ids are scoped per scene: two scenes may both have a shape called "a". */
const scoped = (sceneIndex: number, shapeId: string) => `${sceneIndex}:${shapeId}`

/**
 * A board shape moved onto the page and given a scene-scoped identity.
 *
 * Arrow ends are rewritten too, or an arrow in scene three would find scene
 * one's box of the same name and reach back up the page to it.
 */
function place(sceneIndex: number, shape: BoardShape): BoardShape {
  const dy = sceneOffsetY(sceneIndex)

  return {
    ...shape,
    id: scoped(sceneIndex, shape.id),
    y: shape.y + dy,
    from: shape.from ? scoped(sceneIndex, shape.from) : null,
    to: shape.to ? scoped(sceneIndex, shape.to) : null,
    points: shape.points.map((point) => ({ x: point.x, y: point.y + dy })),
  }
}

const CHARTS = new Set<BoardShape['kind']>(['barchart', 'linechart', 'piechart'])

export const LessonBoard = forwardRef<LessonPainter, { className?: string }>(
  function LessonBoard({ className }, ref) {
    const [shapes, setShapes] = useState<BoardShape[]>([])
    const [pictures, setPictures] = useState<Map<string, string>>(new Map())
    const [frame, setFrame] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
    const [view, setView] = useState<View | null>(null)

    /**
     * What has been painted, readable without waiting for a render.
     *
     * `has()` is asked mid-scene, between two paints in the same tick, and
     * state set in this tick is not visible until the next one — so the answer
     * has to come from somewhere React is not batching.
     */
    const drawn = useRef(new Set<string>())

    const has = useCallback(
      (sceneIndex: number, shapeId: string) => drawn.current.has(scoped(sceneIndex, shapeId)),
      []
    )

    const reset = useCallback(() => {
      drawn.current.clear()
      setShapes([])
      setPictures(new Map())
      setFrame(null)
      setView(null)
    }, [])

    // The scene is part of the painter's signature and unused here: the tldraw
// painter needed the siblings to aim arrows, and this one finds them in the
// shape list it is already holding.
const paint = useCallback((sceneIndex: number, shape: BoardShape) => {
      const id = scoped(sceneIndex, shape.id)
      if (drawn.current.has(id)) return
      drawn.current.add(id)

      const placed = place(sceneIndex, shape)

      // A chart has no search query to be filed under, so the painter files it
      // under a synthetic one. Writing that key into `text` means the lookup
      // for a chart and the lookup for a photograph are the same lookup.
      const ready = CHARTS.has(placed.kind)
        ? { ...placed, text: chartKey(sceneIndex, shape.id) }
        : placed

      // A table is a grid of cells, and a cell is a box with a word in it.
      // Expanding here rather than in the renderer means every cell inherits
      // the wobble, the fills and the label wrapping for free.
      const next = isComposite(ready.kind) ? expandComposite(ready) : [ready]

      setShapes((current) => [...current, ...next])
    }, [])

    /**
     * Points the camera at a scene.
     *
     * At the scene's own box, never at the shapes drawn so far: framing the
     * subset means the camera lurches every time a shape lands, and the motion
     * that reads as human is the pan between scenes, not fidgeting during one.
     */
    const focus = useCallback((sceneIndex: number) => {
      setFrame({ x: 0, y: sceneOffsetY(sceneIndex), w: SCENE_W, h: SCENE_H })
      // A new object every time: identity is what the canvas treats as "move
      // now", so re-focusing the same scene still moves.
      setView({ type: 'fit' })
    }, [])

    /**
     * The line from one scene down to the next.
     *
     * Scenes are far enough apart that the gap between them reads as a break;
     * a stroke across it says the second follows from the first, which is the
     * one thing the layout cannot say on its own.
     */
    const connect = useCallback((fromScene: number) => {
      const id = `link:${fromScene}`
      if (drawn.current.has(id)) return
      drawn.current.add(id)

      const top = sceneOffsetY(fromScene) + SCENE_H - 40
      const bottom = sceneOffsetY(fromScene + 1) + 30
      const x = SCENE_W / 2

      setShapes((current) => [
        ...current,
        {
          id,
          kind: 'line',
          text: '',
          x: x - 2,
          y: top,
          w: 4,
          h: bottom - top,
          from: null,
          to: null,
          color: 'grey',
          fill: 'none',
          size: 's',
          dash: 'dotted',
          at: 0,
          anchor: '',
          points: [
            { x, y: top },
            { x: x + 14, y: (top + bottom) / 2 },
            { x, y: bottom },
          ],
          data: [],
          parent: null,
        },
      ])
    }, [])

    const addImage = useCallback((key: string, found: Picture) => {
      // Anything an <img> could not load is a miss. One malformed src used to
      // be able to take a whole scene down with it.
      if (!/^(https?:|\/|data:|blob:)/.test(found.src)) {
        console.warn('[board] ignoring unusable image src', found.src.slice(0, 60))
        return
      }
      setPictures((current) => new Map(current).set(key.trim().toLowerCase(), found.src))
    }, [])

    useImperativeHandle(ref, () => ({ has, reset, focus, connect, paint, addImage }), [
      has,
      reset,
      focus,
      connect,
      paint,
      addImage,
    ])

    const canvas = useMemo(
      () => (
        <BoardCanvas
          shapes={shapes}
          symbols={pictures}
          view={view}
          frame={frame ?? undefined}
          paper="grid"
          className="absolute inset-0"
        />
      ),
      [shapes, pictures, view, frame]
    )

    return (
      <div className={className ?? 'absolute inset-0 bg-white'}>
        {/*
          Shapes arrive one at a time, in the order the narration reaches them,
          and each fades up as it lands. React only mounts the new ones, so the
          animation runs once per shape without anything having to track which
          are new.
        */}
        <style>{`
          @keyframes lesson-shape-in {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: none; }
          }
          .lesson-board g[data-shape-id] {
            animation: lesson-shape-in 260ms ease-out both;
          }
          @media (prefers-reduced-motion: reduce) {
            .lesson-board g[data-shape-id] { animation: none; }
          }
        `}</style>
        <div className="lesson-board absolute inset-0">{canvas}</div>
      </div>
    )
  }
)
