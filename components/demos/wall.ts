'use client'

import {
  createShapeId,
  toRichText,
  type Editor,
  type TLDefaultColorStyle,
  type TLShapeId,
} from 'tldraw'
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
  /**
   * A spoken interstitial: while [at, until) the camera shows only this box —
   * one phrase, full screen, nothing else — then returns to the station.
   * Shapes of a focused act are kept out of the station's camera frame.
   */
  focus?: { x: number; y: number; w: number; h: number; until: number }
}

export interface CueSheet {
  audio: string
  duration: number
  scenes: { n: number; start: number; end: number; beats: number[] }[]
}

/* ---------------------------------------------------------------- stations */

export const STATION_W = 2100
export const STATION_H = 1300
/**
 * One column: the wall reads downward, so moving between sections is a
 * vertical scroll — the way a long sheet of paper would unroll.
 */
const STRIDE_Y = 1800

/** Where scene n (1-based) lives on the wall. */
export function station(n: number) {
  return { x: 0, y: (n - 1) * STRIDE_Y }
}

export function stationBounds(n: number) {
  const { x, y } = station(n)
  return { x: x - 80, y: y - 80, w: STATION_W + 160, h: STATION_H + 160 }
}

/* ----------------------------------------------------------------- colours */

export type Tone = 'black' | 'grey' | 'red' | 'blue' | 'green' | 'orange' | 'violet'
export type Size = 's' | 'm' | 'l' | 'xl'
export type Dash = 'draw' | 'dashed' | 'dotted' | 'solid'
export type Fill = 'none' | 'semi' | 'solid' | 'pattern'

/* ------------------------------------------------------------------ themes */

/**
 * A look for the whole wall, applied at build time.
 *
 * The acts speak in semantic tones — red for danger, blue for the machine,
 * green for relief — and a theme decides what those tones look like on this
 * particular paper. That way five very different walls share one script.
 */
export interface WallTheme {
  /** Semantic tone → tldraw ink for this paper. */
  tone?: Partial<Record<Tone, TLDefaultColorStyle>>
  font?: 'draw' | 'sans' | 'serif' | 'mono'
  /** A default fill for boxes, for looks that want solid poster shapes. */
  fill?: Fill
  dash?: Dash
}

let theme: WallTheme = {}

/** Set (or, with no argument, reset) the wall's look. Call before building. */
export function setWallTheme(next: WallTheme = {}) {
  theme = next
}

const toneOf = (tone?: Tone): TLDefaultColorStyle =>
  theme.tone?.[tone ?? 'black'] ?? ((tone ?? 'black') as TLDefaultColorStyle)
const fontOf = () => theme.font ?? 'draw'
const dashOf = (dash?: Dash) => dash ?? theme.dash ?? 'draw'

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
      color: toneOf(opts.color),
      fill: opts.fill ?? theme.fill ?? 'none',
      dash: dashOf(opts.dash),
      size: opts.size ?? 'm',
      font: fontOf(),
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
      color: toneOf(opts.color),
      size: opts.size ?? 'm',
      font: opts.mono ? 'mono' : fontOf(),
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
      color: toneOf(opts.color),
      fill: 'none',
      dash: dashOf(opts.dash),
      size: opts.size ?? 'm',
      arrowheadStart: 'none',
      arrowheadEnd: opts.head === false ? 'none' : 'arrow',
      font: fontOf(),
      richText: toRichText(opts.text ?? ''),
      labelPosition: 0.5,
      labelColor: toneOf(opts.color),
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
      color: toneOf(opts.color),
      fill: 'none',
      dash: dashOf(opts.dash),
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


/**
 * A phrase said full screen — the only thing on the paper while it is said.
 *
 * The text lives far to the right of the wall's single column, one empty slot
 * per phrase, so no station frame ever includes it and no two phrases share a
 * screen. The camera dives out to it at `at` and comes home at `until`.
 */
export function phraseAct(opts: {
  slot: number
  scene: number
  at: number
  until: number
  text: string
  sub?: string
  color?: Tone
}): Act {
  const { y } = station(opts.scene)
  const px = 3200 + opts.slot * 2800
  const py = y + 420
  const longest = Math.max(...opts.text.split('\n').map((line) => line.length))
  const w = Math.max(1100, longest * 46)
  return {
    at: opts.at,
    focus: { x: px - 180, y: py - 240, w: w + 360, h: 780, until: opts.until },
    make: (e) => [
      ...txt(e, { x: px, y: py, text: opts.text, size: 'xl', color: opts.color }),
      ...(opts.sub
        ? txt(e, { x: px + 6, y: py + 200 + (opts.text.split('\n').length - 1) * 130, text: opts.sub, color: 'grey', size: 's' })
        : []),
    ],
  }
}
