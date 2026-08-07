'use client'

import { createShapeId, toRichText, type Editor, type TLShapeId } from 'tldraw'
// Not re-exported from `tldraw` despite what its docs show, so imported from
// the schema package directly (pinned to the same version).
import { b64Vecs } from '@tldraw/tlschema'

/**
 * The wall kit every mural is drawn with.
 *
 * A mural is one tldraw canvas of stations and a camera that travels between
 * them. Everything on it is an *act*: a shape creation pinned to an absolute
 * second of a recording. The player holds a pointer into the sorted act list
 * and walks it forwards or backwards as the clock moves, so scrubbing is
 * exact — the board at 4:36 is the same board every time, however you got
 * there.
 */

export interface Act {
  /** When this lands, in seconds of the recording. */
  at: number
  make: (editor: Editor) => TLShapeId[]
}

export interface CueSheet {
  audio: string
  duration: number
  scenes: { n: number; start: number; end: number; beats: number[] }[]
}

/* ---------------------------------------------------------------- stations */

export const STATION_W = 2100
export const STATION_H = 1300
const STRIDE_X = 2700
const STRIDE_Y = 1900
const COLS = 6

/** Where scene n (1-based) lives on the wall. */
export function station(n: number) {
  const i = n - 1
  return { x: (i % COLS) * STRIDE_X, y: Math.floor(i / COLS) * STRIDE_Y }
}

export function stationBounds(n: number) {
  const { x, y } = station(n)
  return { x: x - 80, y: y - 80, w: STATION_W + 160, h: STATION_H + 160 }
}

export function muralBounds() {
  const rows = Math.ceil(17 / COLS)
  return {
    x: -120,
    y: -120,
    w: (COLS - 1) * STRIDE_X + STATION_W + 240,
    h: (rows - 1) * STRIDE_Y + STATION_H + 240,
  }
}

/* ----------------------------------------------------------------- colours */

export type Tone = 'black' | 'grey' | 'red' | 'blue' | 'green' | 'orange' | 'violet'
export type Size = 's' | 'm' | 'l' | 'xl'
export type Dash = 'draw' | 'dashed' | 'dotted' | 'solid'
export type Fill = 'none' | 'semi' | 'solid' | 'pattern'

const FONT = 'draw' as const

/* ----------------------------------------------------------------- helpers */

export function geo(
  editor: Editor,
  opts: {
    x: number
    y: number
    w: number
    h: number
    text?: string
    color?: Tone
    fill?: Fill
    dash?: Dash
    size?: Size
    kind?: 'rectangle' | 'ellipse' | 'diamond' | 'cloud'
    align?: 'start' | 'middle'
  }
): TLShapeId[] {
  const id = createShapeId()
  editor.createShape({
    id,
    type: 'geo',
    x: opts.x,
    y: opts.y,
    opacity: 0,
    props: {
      geo: opts.kind ?? 'rectangle',
      w: opts.w,
      h: opts.h,
      color: opts.color ?? 'black',
      fill: opts.fill ?? 'none',
      dash: opts.dash ?? 'draw',
      size: opts.size ?? 'm',
      font: FONT,
      align: opts.align ?? 'middle',
      verticalAlign: 'middle',
      richText: toRichText(opts.text ?? ''),
      scale: 1,
    },
  })
  return [id]
}

export function txt(
  editor: Editor,
  opts: { x: number; y: number; text: string; color?: Tone; size?: Size; w?: number; mono?: boolean }
): TLShapeId[] {
  const id = createShapeId()
  editor.createShape({
    id,
    type: 'text',
    x: opts.x,
    y: opts.y,
    opacity: 0,
    props: {
      richText: toRichText(opts.text),
      color: opts.color ?? 'black',
      size: opts.size ?? 'm',
      font: opts.mono ? 'mono' : FONT,
      textAlign: 'start',
      autoSize: true,
      w: opts.w ?? 8,
      scale: 1,
    },
  })
  return [id]
}

export function arrow(
  editor: Editor,
  opts: {
    from: [number, number]
    to: [number, number]
    text?: string
    color?: Tone
    dash?: Dash
    bend?: number
    size?: Size
    head?: boolean
  }
): TLShapeId[] {
  const id = createShapeId()
  editor.createShape({
    id,
    type: 'arrow',
    x: opts.from[0],
    y: opts.from[1],
    opacity: 0,
    props: {
      kind: 'arc',
      start: { x: 0, y: 0 },
      end: { x: opts.to[0] - opts.from[0], y: opts.to[1] - opts.from[1] },
      bend: opts.bend ?? 0,
      color: opts.color ?? 'black',
      fill: 'none',
      dash: opts.dash ?? 'draw',
      size: opts.size ?? 'm',
      arrowheadStart: 'none',
      arrowheadEnd: opts.head === false ? 'none' : 'arrow',
      font: FONT,
      richText: toRichText(opts.text ?? ''),
      labelPosition: 0.5,
      labelColor: opts.color ?? 'black',
      scale: 1,
      elbowMidPoint: 0.5,
    },
  })
  return [id]
}

/**
 * Waypoints, filled in.
 *
 * tldraw's freehand renderer treats the points as a real pen trail — sparse
 * corners of a rectangle come out as four flicks with bulging joints, which is
 * what turned every icon into scribble. A dense trail every ~14px is what an
 * actual pen would have left, and the renderer behaves.
 */
export function densify(points: [number, number][], step = 14): [number, number][] {
  const out: [number, number][] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]
    const [bx, by] = points[i]
    const run = Math.hypot(bx - ax, by - ay)
    const n = Math.max(1, Math.round(run / step))
    for (let j = 1; j <= n; j++) out.push([ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n])
  }
  return out
}

/** A freehand stroke through the given points, in tldraw's own hand style. */
export function stroke(
  editor: Editor,
  rawPoints: [number, number][],
  opts: { color?: Tone; size?: Size; dash?: Dash; closed?: boolean } = {}
): TLShapeId[] {
  const points = densify(rawPoints)
  const [ox, oy] = points[0]
  const id = createShapeId()
  editor.createShape({
    id,
    type: 'draw',
    x: ox,
    y: oy,
    opacity: 0,
    props: {
      color: opts.color ?? 'black',
      fill: 'none',
      dash: opts.dash ?? 'draw',
      size: opts.size ?? 's',
      segments: [
        {
          type: 'free' as const,
          path: b64Vecs.encodePoints(points.map(([x, y]) => ({ x: x - ox, y: y - oy, z: 0.5 }))),
        },
      ],
      isComplete: true,
      isClosed: opts.closed ?? false,
      isPen: false,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
    },
  })
  return [id]
}

