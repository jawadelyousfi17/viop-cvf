'use client'

import {
  AssetRecordType,
  Box,
  createShapeId,
  EASINGS,
  getIndices,
  toRichText,
  type Editor,
  type IndexKey,
  type TLGeoShape,
  type TLShapeId,
} from 'tldraw'
// Not re-exported from `tldraw` despite what its docs show, so imported from
// the schema package directly (pinned to the same version).
import { b64Vecs } from '@tldraw/tlschema'
import { BOARD_FONT, SCENE_GAP, SCENE_H, SCENE_W, type BoardShape } from '@/lib/lesson'
import { CHART_KINDS, chartKey } from '@/lib/chart'

type GeoStyle = TLGeoShape['props']['geo']

/** Maps a board shape kind onto tldraw's `geo` style. */
const GEO_KINDS: Record<string, GeoStyle> = {
  box: 'rectangle',
  ellipse: 'ellipse',
  diamond: 'diamond',
  triangle: 'triangle',
  hexagon: 'hexagon',
  star: 'star',
  cloud: 'cloud',
  oval: 'oval',
  xbox: 'x-box',
  check: 'check-box',
  heart: 'heart',
  pentagon: 'pentagon',
  octagon: 'octagon',
  trapezoid: 'trapezoid',
  rhombus: 'rhombus',
  arrowright: 'arrow-right',
  arrowleft: 'arrow-left',
  arrowup: 'arrow-up',
  arrowdown: 'arrow-down',
}

/**
 * Nothing a person draws is perfectly square, and perfectly square is exactly
 * what reads as machine-generated. These are the tolerances of a hand: a couple
 * of pixels of drift, a fraction of a degree of tilt, a connector that bows
 * rather than ruling straight.
 *
 * The wobble is derived from each shape's id rather than Math.random(), so a
 * scene looks identical every time it's replayed or skipped back to.
 */
const HAND = {
  /** Max positional drift, in page units. */
  drift: 3,
  /** Max tilt in radians, by shape family. */
  tiltBox: 0.011, // ~0.6°
  tiltText: 0.005, // ~0.3°
  tiltNote: 0.045, // ~2.6°, the way a sticky lands
  /** Max arrow bow, in page units. */
  bend: 15,
}

/** FNV-1a. Small, fast, and stable across runs — which is the point. */
function hash(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic value in [-amount, amount], keyed on a shape id and a salt. */
function wobble(id: string, salt: string, amount: number) {
  return ((hash(`${id}:${salt}`) % 2001) / 1000 - 1) * amount
}

const NOTE_SIZE = 200

/** Floor for a table row, so a wrapped label can't spill into the row below. */
const MIN_ROW_H = 48

/** Screen pixels the player's header and control bar cover, for camera framing. */
const CHROME_TOP = 96
const CHROME_BOTTOM = 230

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface Vec2 {
  x: number
  y: number
}

interface TraceJob {
  id: TLShapeId
  type: 'text' | 'geo' | 'note' | 'arrow' | 'draw' | 'highlight' | 'line' | 'image'
  /** Page-space path the pen follows while the shape inks in. */
  path: Vec2[]
  /** Set for freehand kinds, whose real points grow as the pen moves. */
  stroke: { points: { x: number; y: number; z: number }[] } | null
  /**
   * Composites (a table, an array, a bar chart) are many tldraw shapes drawn as
   * one gesture. They ink in together with the primary shape.
   */
  extra?: { id: TLShapeId; type: TraceJob['type'] }[]
}

/** Splits a composite's text into rows of cells: newlines are rows, pipes are columns. */
function parseGrid(text: string): string[][] {
  return text
    .split('\n')
    .map((row) => row.split('|').map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean))
}

/** Total length of a polyline, used to pace the trace. */
function pathLength(path: Vec2[]) {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
  }
  return total
}

/** Perimeter of a box, starting top-left and closing a little past the start. */
function boxPath(x: number, y: number, w: number, h: number): Vec2[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
    { x, y },
    { x: x + w * 0.12, y },
  ]
}

/** Points around an ellipse inscribed in the box, with a slight overshoot. */
function ellipsePath(x: number, y: number, w: number, h: number): Vec2[] {
  const cx = x + w / 2
  const cy = y + h / 2
  const steps = 24
  const path: Vec2[] = []
  for (let i = 0; i <= steps * 1.06; i++) {
    const a = -Math.PI / 2 + (i / steps) * Math.PI * 2
    path.push({ x: cx + (Math.cos(a) * w) / 2, y: cy + (Math.sin(a) * h) / 2 })
  }
  return path
}

/** A left-to-right sweep per line of text, the way you'd actually write it. */
function textPath(x: number, y: number, w: number, h: number, lines: number): Vec2[] {
  const rows = Math.max(1, Math.min(4, lines))
  const path: Vec2[] = []
  for (let i = 0; i < rows; i++) {
    const ly = y + (h * (i + 0.6)) / rows
    path.push({ x, y: ly }, { x: x + w, y: ly })
  }
  return path
}

/** Kinds built from many tldraw shapes rather than one. */
const COMPOSITE_KINDS = new Set(['table', 'array', 'stack'])

const isChart = (kind: BoardShape['kind']) => (CHART_KINDS as readonly string[]).includes(kind)

/** Kinds whose outline is a circle rather than a box. */
const ROUND_GEOS = new Set(['ellipse', 'oval', 'cloud', 'heart', 'octagon'])

/**
 * The saturated partner each tint casts as its shadow.
 *
 * A filled shape with a solid twin sitting a few pixels behind it is the single
 * detail that makes a hand-drawn board read as designed rather than merely
 * sketched — it is what every Excalidraw diagram does. Black and grey are
 * absent deliberately: a black blob behind a black outline is a smudge, not a
 * shadow, so structural shapes cast nothing.
 */
const SHADOW_COLOR: Record<string, TLGeoShape['props']['color']> = {
  'light-blue': 'blue',
  'light-green': 'green',
  'light-red': 'red',
  'light-violet': 'violet',
  blue: 'blue',
  green: 'green',
  red: 'red',
  violet: 'violet',
  orange: 'orange',
  yellow: 'yellow',
}

/** How far behind and below the shadow sits. */
const SHADOW_OFFSET = 10

/**
 * Draws one lesson onto a shared tldraw canvas. Scenes are placed side by side
 * so the whole lesson lives on one board, and shapes fade and rise into place
 * as the narration reaches them.
 */
export class BoardPainter {
  private readonly editor: Editor
  /** Board shape id (scoped per scene) -> the tldraw shape it became. */
  private readonly painted = new Map<string, TLShapeId>()
  /** Page-space rect of each painted shape, for aiming arrows. */
  private readonly rects = new Map<string, Rect>()
  /** Pending camera retries, cancelled when the scene changes. */
  private readonly cameraFrames = new Set<number>()
  /** Pending trace frames, cancelled on reset. */
  private readonly frames = new Set<number>()
  /** Shapes waiting to be traced, drawn one at a time. */
  private readonly queue: TraceJob[] = []
  private tracing = false
  /** Jobs queued or mid-trace, so they can be completed instantly on a skip. */
  private readonly inFlight = new Map<TLShapeId, TraceJob>()
  /** Resolved image lookups, keyed by lowercased search query. */
  private readonly images = new Map<
    string,
    { src: string; width: number; height: number; animated?: boolean }
  >()
  /** Sub-shape ids standing in for a whole composite; arrows must not bind to them. */
  private readonly composites = new Set<TLShapeId>()
  /** Image shapes drawn as placeholders, awaiting their picture. */
  private readonly placeholders = new Map<
    string,
    { id: TLShapeId; key: string; sceneIndex: number; shape: BoardShape; siblings: BoardShape[] }
  >()
  /** Board shapes actually drawn per scene, for easing the camera outward. */
  private readonly sceneDrawn = new Map<number, BoardShape[]>()
  /** How many shapes each scene will end up with. */
  private readonly sceneTotals = new Map<number, number>()
  private lastReframe = 0

  constructor(editor: Editor) {
    this.editor = editor
  }

  /** Scenes stack downward, so the lesson scrolls like one long page. */
  static sceneOffsetY(sceneIndex: number) {
    return sceneIndex * (SCENE_H + SCENE_GAP)
  }

  private key(sceneIndex: number, shapeId: string) {
    return `${sceneIndex}:${shapeId}`
  }

  has(sceneIndex: number, shapeId: string) {
    return this.painted.has(this.key(sceneIndex, shapeId))
  }

  /**
   * Moves the camera so a scene fills the part of the viewport that isn't
   * covered by the player's own chrome. `zoomToBounds` centres what you give
   * it, so the bounds are padded asymmetrically — by the same ratio the header
   * and control bar occupy on screen — to push the board up into the clear
   * space.
   *
   * Frames the scene's actual content rather than the nominal scene box, so
   * a scene the spacing pass has widened still fits, and a sparse scene isn't
   * marooned in empty board.
   */
  focus(sceneIndex: number, shapes?: BoardShape[], duration = 750, attempt = 0) {
    if (attempt === 0) {
      for (const frame of this.cameraFrames) cancelAnimationFrame(frame)
      this.cameraFrames.clear()
      // A trace still running belongs to the scene we're leaving; finish it
      // instantly rather than stranding a half-inked shape.
      this.flushTraces()
    }

    const screen = this.editor.getViewportScreenBounds()

    // On the very first scene the editor has only just mounted and may not have
    // measured its container yet. Framing against a zero-height viewport sends
    // the camera somewhere the board isn't — which looks like a blank canvas
    // while the narration plays on. Wait for a real measurement instead.
    if (screen.h < CHROME_TOP + CHROME_BOTTOM + 80 && attempt < 30) {
      const retry = requestAnimationFrame(() =>
        this.focus(sceneIndex, shapes, attempt === 0 ? duration : 0, attempt + 1)
      )
      this.cameraFrames.add(retry)
      return
    }

    // Always framed on the scene's own box, never on the subset drawn so far.
    // Content is centred inside that box before it reaches us, so every scene
    // sits centred on screen — and the camera can never drift far enough to
    // reveal a neighbouring scene, which it used to.
    //
    // The camera does not move within a scene. It used to ease outward as the
    // board filled, but a zoom on every new element is restless to watch — the
    // motion that reads as human is the pan between scenes, not fidgeting
    // during one.
    const w = SCENE_W
    const x = 0
    const y = 0

    // Frame what the scene actually occupies, not the nominal box. A dense
    // scene runs past the bottom, and framing 0..SCENE_H would cut the last
    // row off — or, when it starts above zero, the first one.
    const top = shapes?.length ? Math.min(0, ...shapes.map((shape) => shape.y)) : 0
    const bottom = shapes?.length
      ? Math.max(
          SCENE_H,
          ...shapes.map((shape) => shape.y + (shape.kind === 'note' ? 200 : shape.h))
        )
      : SCENE_H
    // Scenes sit SCENE_GAP apart, so a taller frame still can't reach the next.
    const h = Math.min(SCENE_H + SCENE_GAP - 80, bottom - top + 40)

    const usable = Math.max(200, screen.h - CHROME_TOP - CHROME_BOTTOM)
    const padTop = (h * CHROME_TOP) / usable
    const padBottom = (h * CHROME_BOTTOM) / usable

    this.editor.zoomToBounds(
      new Box(x, y + top - 20 + BoardPainter.sceneOffsetY(sceneIndex) - padTop, w, h + padTop + padBottom),
      {
        inset: 24,
        animation: duration > 0 ? { duration, easing: EASINGS.easeInOutCubic } : undefined,
      }
    )
  }

  /** Removes everything from the board. Used when starting a new lesson. */
  reset() {
    for (const frame of this.frames) cancelAnimationFrame(frame)
    this.frames.clear()
    this.queue.length = 0
    this.inFlight.clear()
    this.tracing = false

    const ids = this.editor.getCurrentPageShapeIds()
    if (ids.size) this.editor.deleteShapes([...ids])
    this.painted.clear()
    this.rects.clear()
    this.placeholders.clear()
    this.composites.clear()
    this.sceneDrawn.clear()
    this.sceneTotals.clear()
    this.lastReframe = 0
  }

  /**
   * Paints a shape if it hasn't been painted yet. Arrows recursively paint the
   * shapes they connect first, so a connector can never dangle.
   *
   * @param animate false when catching up after a scene skip, where a dozen
   *   simultaneous fade-ins would just look like flicker.
   */
  paint(sceneIndex: number, shape: BoardShape, scene: BoardShape[], animate = true) {
    const key = this.key(sceneIndex, shape.id)
    if (this.painted.has(key)) return
    this.sceneTotals.set(sceneIndex, scene.length)

    if (shape.kind === 'arrow') {
      for (const ref of [shape.from, shape.to]) {
        if (!ref || this.has(sceneIndex, ref)) continue
        const target = scene.find((s) => s.id === ref)
        if (target) this.paint(sceneIndex, target, scene, animate)
      }
    }

    const offsetY = BoardPainter.sceneOffsetY(sceneIndex)
    const id = createShapeId()

    if (COMPOSITE_KINDS.has(shape.kind)) {
      const primary = this.paintComposite(shape, offsetY, animate)
      if (primary) {
        this.painted.set(key, primary)
        const list = this.sceneDrawn.get(sceneIndex) ?? []
        list.push(shape)
        this.sceneDrawn.set(sceneIndex, list)
      }
      return
    }

    if (shape.kind === 'arrow' || shape.kind === 'elbow') {
      this.paintArrow(sceneIndex, shape, id, offsetY, animate)
    } else if (shape.kind === 'image' || shape.kind === 'symbol') {
      this.paintImage(shape, id, offsetY, animate, sceneIndex, scene)
    } else if (shape.kind === 'label') {
      this.paintLabel(shape, id, offsetY, animate)
    } else if (shape.kind === 'icon') {
      this.paintIcon(shape, id, offsetY, animate)
    } else if (shape.kind === 'code') {
      this.paintCode(shape, id, offsetY, animate)
    } else if (isChart(shape.kind)) {
      this.paintImage(shape, id, offsetY, animate, sceneIndex, scene)
    } else if (shape.kind === 'ring') {
      this.paintRing(shape, id, offsetY, animate)
    } else if (shape.kind === 'curve' || shape.kind === 'highlight') {
      this.paintStroke(shape, id, offsetY, animate)
    } else if (shape.kind === 'line') {
      this.paintLine(shape, id, offsetY, animate)
    } else if (shape.kind === 'note') {
      this.paintNote(shape, id, offsetY, animate)
    } else if (shape.kind === 'text') {
      this.paintText(shape, id, offsetY, animate)
    } else {
      this.paintGeo(shape, id, offsetY, animate, scene.some((s) => s.parent === shape.id))
    }

    this.painted.set(key, id)

    const drawn = this.sceneDrawn.get(sceneIndex) ?? []
    drawn.push(shape)
    this.sceneDrawn.set(sceneIndex, drawn)
  }

  private paintText(shape: BoardShape, id: TLShapeId, offsetY: number, animate: boolean) {
    const x = shape.x + wobble(shape.id, 'x', HAND.drift)
    this.editor.createShape({
      id,
      type: 'text',
      x,
      y: shape.y + offsetY,
      rotation: wobble(shape.id, 'r', HAND.tiltText),
      opacity: animate ? 0 : 1,
      props: {
        richText: toRichText(shape.text || ' '),
        color: shape.color,
        size: shape.size,
        font: BOARD_FONT,
        textAlign: 'start',
        autoSize: false,
        w: Math.max(60, shape.w),
        scale: 1,
      },
    })
    this.rects.set(id, { x, y: shape.y + offsetY, w: shape.w, h: shape.h })
    this.reveal(
      id,
      'text',
      textPath(x, shape.y + offsetY, Math.max(60, shape.w), shape.h, shape.text.split('\n').length),
      animate
    )
  }

  /**
   * @param holds whether other shapes are drawn inside this one, which changes
   *   where its label goes and how heavily it may be filled.
   */
  private paintGeo(
    shape: BoardShape,
    id: TLShapeId,
    offsetY: number,
    animate: boolean,
    holds = false
  ) {
    const x = shape.x + wobble(shape.id, 'x', HAND.drift)
    const rotation = wobble(shape.id, 'r', HAND.tiltBox)

    // A container's name belongs in the band the layout reserved for it at the
    // top, not down the middle of the box on top of its own contents.
    const verticalAlign = holds ? 'start' : 'middle'
    // And it is a background, not a block of colour: whatever sits inside has
    // to read against it.
    const fill = holds && shape.fill === 'solid' ? 'semi' : shape.fill

    // Drawn first so it sits behind: tldraw stacks in creation order.
    const shadow = this.paintShadow(shape, x, shape.y + offsetY, rotation, animate, fill)

    this.editor.createShape({
      id,
      type: 'geo',
      x,
      y: shape.y + offsetY,
      rotation,
      opacity: animate ? 0 : 1,
      props: {
        geo: GEO_KINDS[shape.kind] ?? 'rectangle',
        w: Math.max(40, shape.w),
        h: Math.max(40, shape.h),
        richText: toRichText(shape.text ?? ''),
        color: shape.color,
        labelColor: shape.color === 'yellow' ? 'black' : shape.color,
        fill,
        dash: shape.dash,
        size: shape.size,
        font: BOARD_FONT,
        align: 'middle',
        verticalAlign,
        scale: 1,
      },
    })
    this.rects.set(id, { x, y: shape.y + offsetY, w: shape.w, h: shape.h })
    this.reveal(
      id,
      'geo',
      ROUND_GEOS.has(GEO_KINDS[shape.kind] ?? '')
        ? ellipsePath(x, shape.y + offsetY, shape.w, shape.h)
        : boxPath(x, shape.y + offsetY, shape.w, shape.h),
      animate,
      shadow ? [{ id: shadow, type: 'geo' }] : undefined
    )
  }

  /**
   * The solid twin behind a filled shape. Returns its id so it can be revealed
   * on the same beat as the shape it belongs to — a shadow that fades in on its
   * own is just a second rectangle.
   */
  private paintShadow(
    shape: BoardShape,
    x: number,
    y: number,
    rotation: number,
    animate: boolean,
    fill: BoardShape['fill'] = shape.fill
  ): TLShapeId | null {
    const color = SHADOW_COLOR[shape.color]
    if (!color || fill === 'none') return null

    const id = createShapeId()
    this.editor.createShape({
      id,
      type: 'geo',
      x: x + SHADOW_OFFSET,
      y: y + SHADOW_OFFSET,
      rotation,
      opacity: animate ? 0 : 1,
      props: {
        geo: GEO_KINDS[shape.kind] ?? 'rectangle',
        w: Math.max(40, shape.w),
        h: Math.max(40, shape.h),
        color,
        fill: 'solid',
        dash: 'solid',
        size: shape.size,
        scale: 1,
      },
    })
    // Never registered as a painted shape, so nothing can bind an arrow to it.
    return id
  }

  /**
   * Source, in a monospace face, on a tinted card.
   *
   * A board explaining software eventually has to show some, and lettering it
   * in the hand-drawn face makes code look like prose about code. Monospace is
   * also what makes the highlight possible: every glyph is the same width, so
   * the line to box is found by counting lines rather than by measuring text.
   *
   * A line ending in a lone `<` marks itself as the one being discussed and is
   * boxed — cheaper to write than a separate field, and it reads in the source
   * as the arrow someone would draw in the margin.
   */
  private paintCode(shape: BoardShape, id: TLShapeId, offsetY: number, animate: boolean) {
    const x = shape.x + wobble(shape.id, 'x', HAND.drift)
    const y = shape.y + offsetY
    const extra: { id: TLShapeId; type: TraceJob['type'] }[] = []

    const raw = (shape.text ?? '').split('\n')
    const marked = raw.findIndex((line) => /\s<\s*$/.test(line))
    const lines = raw.map((line) => line.replace(/\s<\s*$/, ''))

    // The card. Kept pale so the lettering on it stays the thing you read.
    this.editor.createShape({
      id,
      type: 'geo',
      x,
      y,
      rotation: wobble(shape.id, 'r', HAND.tiltBox * 0.4),
      opacity: animate ? 0 : 1,
      props: {
        geo: 'rectangle',
        w: Math.max(200, shape.w),
        h: Math.max(80, shape.h),
        color: shape.color === 'black' ? 'grey' : shape.color,
        fill: 'semi',
        dash: 'solid',
        size: 's',
        scale: 1,
      },
    })

    const lineHeight = Math.min(46, (shape.h - 40) / Math.max(1, lines.length))
    const top = y + 22

    if (marked !== -1) {
      const boxId = createShapeId()
      this.editor.createShape({
        id: boxId,
        type: 'geo',
        x: x + 12,
        y: top + marked * lineHeight - 6,
        opacity: animate ? 0 : 1,
        props: {
          geo: 'rectangle',
          w: Math.max(100, shape.w - 24),
          h: lineHeight + 8,
          color: 'orange',
          fill: 'none',
          dash: 'draw',
          size: 's',
          scale: 1,
        },
      })
      extra.push({ id: boxId, type: 'geo' })
    }

    for (const [index, line] of lines.entries()) {
      const lineId = createShapeId()
      this.editor.createShape({
        id: lineId,
        type: 'text',
        x: x + 26,
        y: top + index * lineHeight,
        opacity: animate ? 0 : 1,
        props: {
          richText: toRichText(line || ' '),
          color: 'black',
          size: 's',
          font: 'mono',
          textAlign: 'start',
          autoSize: false,
          w: Math.max(120, shape.w - 52),
          scale: 1,
        },
      })
      extra.push({ id: lineId, type: 'text' })
    }

    this.rects.set(id, { x, y, w: shape.w, h: shape.h })
    this.reveal(id, 'geo', boxPath(x, y, shape.w, shape.h), animate, extra)
  }

  private paintNote(shape: BoardShape, id: TLShapeId, offsetY: number, animate: boolean) {
    const x = shape.x + wobble(shape.id, 'x', HAND.drift)
    this.editor.createShape({
      id,
      type: 'note',
      x,
      y: shape.y + offsetY,
      rotation: wobble(shape.id, 'r', HAND.tiltNote),
      opacity: animate ? 0 : 1,
      props: {
        richText: toRichText(shape.text ?? ''),
        color: shape.color === 'black' ? 'yellow' : shape.color,
        labelColor: 'black',
        size: shape.size === 'xl' ? 'l' : shape.size,
        font: BOARD_FONT,
        align: 'middle',
        verticalAlign: 'middle',
        scale: 1,
      },
    })
    this.rects.set(id, { x, y: shape.y, w: NOTE_SIZE, h: NOTE_SIZE })
    this.reveal(id, 'note', boxPath(x, shape.y + offsetY, NOTE_SIZE, NOTE_SIZE), animate)
  }

  /**
   * Freehand strokes: `curve` for plotted lines and sketched shapes, and
   * `highlight` for marker-pen emphasis. Both use tldraw's point-encoded
   * stroke format, which gives them the same hand-drawn character as the
   * rest of the board.
   */
  private paintStroke(shape: BoardShape, id: TLShapeId, offsetY: number, animate: boolean) {
    const origin = { x: shape.x, y: shape.y + offsetY }
    const points = shape.points.map((p) => ({
      x: p.x - origin.x,
      y: p.y + offsetY - origin.y,
      z: 0.5,
    }))

    this.editor.createShape({
      id,
      type: shape.kind === 'highlight' ? 'highlight' : 'draw',
      x: origin.x,
      y: origin.y,
      opacity: animate ? 0 : 1,
      props: {
        color: shape.color,
        size: shape.size,
        segments: [{ type: 'free' as const, path: b64Vecs.encodePoints(points) }],
        isComplete: true,
        isPen: false,
        scale: 1,
        ...(shape.kind === 'highlight' ? {} : { fill: shape.fill, dash: shape.dash, isClosed: false }),
      },
    })

    this.rects.set(id, { x: origin.x, y: origin.y, w: shape.w, h: shape.h })

    const type = shape.kind === 'highlight' ? 'highlight' : ('draw' as const)
    if (animate) {
      this.enqueue({
        id,
        type,
        path: points.map((p) => ({ x: p.x + origin.x, y: p.y + origin.y })),
        stroke: { points },
      })
    }
  }

  /**
   * A photograph or diagram fetched for the scene. The lookup runs when the
   * scene starts, so by the time the narration reaches the shape the result is
   * usually cached; if it isn't there yet, or nothing was found, a labelled
   * dashed frame stands in rather than leaving a hole in the layout.
   */
  private paintImage(
    shape: BoardShape,
    id: TLShapeId,
    offsetY: number,
    animate: boolean,
    sceneIndex = 0,
    siblings: BoardShape[] = []
  ) {
    const x = shape.x + wobble(shape.id, 'x', HAND.drift)
    // A chart has no search query, so it is filed under a synthetic one.
    const query = isChart(shape.kind)
      ? chartKey(sceneIndex, shape.id)
      : shape.text.trim().toLowerCase()
    const resolved = this.images.get(query)
    // tldraw validates an asset's src and throws if it isn't a URL, and that
    // throw happens inside the player's animation tick — so one malformed
    // lookup takes down the whole scene rather than one picture. A result that
    // doesn't look like something an <img> could load is treated as a miss.
    const found = resolved && /^(https?:|\/|data:|blob:)/.test(resolved.src) ? resolved : undefined
    if (resolved && !found) {
      console.warn('[board] ignoring unusable image src', resolved.src.slice(0, 60))
    }

    if (!found) {
      this.editor.createShape({
        id,
        type: 'geo',
        x,
        y: shape.y + offsetY,
        rotation: wobble(shape.id, 'r', HAND.tiltBox),
        opacity: animate ? 0 : 1,
        props: {
          geo: 'rectangle',
          w: shape.w,
          h: shape.h,
          richText: toRichText(shape.text ?? ''),
          color: 'grey',
          labelColor: 'grey',
          fill: 'none',
          dash: 'dashed',
          size: 's',
          font: BOARD_FONT,
          align: 'middle',
          verticalAlign: 'middle',
          scale: 1,
        },
      })
      this.rects.set(id, { x, y: shape.y + offsetY, w: shape.w, h: shape.h })
      this.reveal(id, 'geo', boxPath(x, shape.y + offsetY, shape.w, shape.h), animate)

      // Remember it so the picture can take its place when the lookup lands.
      if (query) {
        this.placeholders.set(query, {
          id,
          key: this.key(sceneIndex, shape.id),
          sceneIndex,
          shape,
          siblings,
        })
      }
      return
    }

    // Fit the real aspect ratio inside the box the model reserved, so a portrait
    // photo doesn't get stretched into the landscape slot it was given.
    const ratio = found.width / found.height
    let w = shape.w
    let h = shape.w / ratio
    if (h > shape.h) {
      h = shape.h
      w = shape.h * ratio
    }

    const assetId = AssetRecordType.createId()
    this.editor.createAssets([
      {
        id: assetId,
        type: 'image',
        typeName: 'asset',
        meta: {},
        props: {
          w: found.width,
          h: found.height,
          name: shape.text.slice(0, 80),
          isAnimated: found.animated ?? false,
          mimeType: found.animated ? 'image/gif' : null,
          src: found.src,
        },
      },
    ])

    this.editor.createShape({
      id,
      type: 'image',
      x: x + (shape.w - w) / 2,
      y: shape.y + offsetY + (shape.h - h) / 2,
      rotation: wobble(shape.id, 'r', HAND.tiltBox),
      opacity: animate ? 0 : 1,
      props: { w, h, assetId, playing: true, altText: shape.text.slice(0, 200) },
    })

    this.rects.set(id, { x, y: shape.y + offsetY, w: shape.w, h: shape.h })
    this.reveal(id, 'image', boxPath(x, shape.y + offsetY, shape.w, shape.h), animate)
  }

  /**
   * Draws the link down into the next scene.
   *
   * Scenes stack vertically with a gap between them, and without something
   * crossing that gap the lesson reads as separate pages that happen to be
   * stacked. A hand-drawn line down the middle, sketched as the camera travels,
   * makes the scroll feel like one continuous board.
   */
  connect(fromScene: number) {
    const key = `link:${fromScene}`
    if (this.painted.has(key)) return

    const top = BoardPainter.sceneOffsetY(fromScene) + SCENE_H + 40
    const bottom = BoardPainter.sceneOffsetY(fromScene + 1) - 40
    if (bottom <= top) return

    const x = SCENE_W / 2
    const steps = 16
    const points: { x: number; y: number; z: number }[] = []
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      points.push({
        // A gentle S, so it reads as drawn rather than ruled.
        x: x + Math.sin(t * Math.PI) * 26 + wobble(key, `w${i}`, 4),
        y: top + (bottom - top) * t,
        z: 0.5,
      })
    }

    const id = createShapeId()
    this.editor.createShape({
      id,
      type: 'draw',
      x: points[0].x,
      y: points[0].y,
      opacity: 0,
      props: {
        color: 'grey',
        fill: 'none',
        dash: 'draw',
        size: 's',
        segments: [
          {
            type: 'free' as const,
            path: b64Vecs.encodePoints(
              points.map((p) => ({ x: p.x - points[0].x, y: p.y - points[0].y, z: p.z }))
            ),
          },
        ],
        isComplete: true,
        isClosed: false,
        isPen: false,
        scale: 1,
        scaleX: 1,
        scaleY: 1,
      },
    })

    this.painted.set(key, id)
    this.enqueue({
      id,
      type: 'draw',
      path: points,
      stroke: { points: points.map((p) => ({ x: p.x - points[0].x, y: p.y - points[0].y, z: p.z })) },
    })
  }

  /**
   * Marker lettering with a dashed rule under it.
   *
   * The signature move of a real whiteboard: nobody draws a rectangle around
   * every word — they write the word and underline it. A box says "this is a
   * node in a diagram"; an underline says "this is a thing I am writing down",
   * which is what most of a working board actually is.
   */
  private paintLabel(shape: BoardShape, id: TLShapeId, offsetY: number, animate: boolean) {
    const x = shape.x + wobble(shape.id, 'x', HAND.drift)
    const y = shape.y + offsetY
    const width = Math.max(80, shape.w)

    this.editor.createShape({
      id,
      type: 'text',
      x,
      y,
      rotation: wobble(shape.id, 'r', HAND.tiltText),
      opacity: animate ? 0 : 1,
      props: {
        richText: toRichText(shape.text || ' '),
        color: shape.color,
        size: shape.size,
        font: BOARD_FONT,
        textAlign: 'start',
        autoSize: false,
        w: width,
        scale: 1,
      },
    })

    // The rule sits just under the lettering and runs a little short of it,
    // the way a hand-drawn underline does.
    const ruleId = createShapeId()
    const ruleY = y + Math.max(38, shape.h * 0.72)
    const indices = getIndices(2)
    this.editor.createShape({
      id: ruleId,
      type: 'line',
      x,
      y: ruleY,
      opacity: animate ? 0 : 1,
      props: {
        color: shape.color,
        dash: 'dashed',
        size: shape.size === 'xl' ? 'm' : 's',
        spline: 'line',
        points: {
          [indices[0]]: { id: indices[0], index: indices[0], x: 0, y: 0 },
          [indices[1]]: {
            id: indices[1],
            index: indices[1],
            x: width * 0.88 + wobble(shape.id, 'rule', 12),
            y: wobble(shape.id, 'tilt', 3),
          },
        },
        scale: 1,
      },
    })

    this.rects.set(id, { x, y, w: width, h: shape.h })

    if (animate) {
      this.enqueue({
        id,
        type: 'text',
        path: [
          { x, y: y + shape.h * 0.4 },
          { x: x + width, y: y + shape.h * 0.4 },
          { x, y: ruleY },
          { x: x + width * 0.88, y: ruleY },
        ],
        stroke: null,
        extra: [{ id: ruleId, type: 'line' }],
      })
    }
  }

  /**
   * A large emoji glyph. Cheap, instant, and needs no network round trip —
   * the right tool when a picture would be overkill but a bare label is flat.
   */
  private paintIcon(shape: BoardShape, id: TLShapeId, offsetY: number, animate: boolean) {
    const x = shape.x + wobble(shape.id, 'x', HAND.drift)
    this.editor.createShape({
      id,
      type: 'text',
      x,
      y: shape.y + offsetY,
      rotation: wobble(shape.id, 'r', HAND.tiltText),
      opacity: animate ? 0 : 1,
      props: {
        richText: toRichText(shape.text || '•'),
        color: shape.color,
        size: 'xl',
        font: BOARD_FONT,
        textAlign: 'middle',
        autoSize: false,
        w: Math.max(60, shape.w),
        scale: 2.2,
      },
    })
    this.rects.set(id, { x, y: shape.y + offsetY, w: shape.w, h: shape.h })
    this.reveal(id, 'text', boxPath(x, shape.y + offsetY, shape.w, shape.h), animate)
  }

  /**
   * Structures drawn as structures.
   *
   * A table rendered as one box with commas in it teaches nothing — the whole
   * point of a table is that the grid does the work. Same for an array: the
   * cells and their indices ARE the explanation. These build the real thing out
   * of many shapes and ink them in as a single gesture.
   */
  private paintComposite(shape: BoardShape, offsetY: number, animate: boolean): TLShapeId | null {
    const rows = parseGrid(shape.text)
    const x = shape.x
    const y = shape.y + offsetY
    const extra: { id: TLShapeId; type: TraceJob['type'] }[] = []

    const cell = (
      cx: number,
      cy: number,
      cw: number,
      ch: number,
      label: string,
      opts: { header?: boolean; accent?: boolean } = {}
    ) => {
      const cellId = createShapeId()
      this.editor.createShape({
        id: cellId,
        type: 'geo',
        x: cx,
        y: cy,
        opacity: animate ? 0 : 1,
        props: {
          geo: 'rectangle',
          w: cw,
          h: ch,
          richText: toRichText(label),
          color: opts.accent || opts.header ? shape.color : 'black',
          labelColor: opts.accent || opts.header ? shape.color : 'black',
          fill: opts.header ? 'semi' : 'none',
          dash: 'draw',
          size: shape.size === 'xl' ? 'l' : shape.size,
          font: BOARD_FONT,
          align: 'middle',
          verticalAlign: 'middle',
          scale: 1,
        },
      })
      extra.push({ id: cellId, type: 'geo' })
      return cellId
    }

    const caption = (
      cx: number,
      cy: number,
      cw: number,
      label: string,
      color: BoardShape['color'] = 'grey'
    ) => {
      const textId = createShapeId()
      this.editor.createShape({
        id: textId,
        type: 'text',
        x: cx,
        y: cy,
        opacity: animate ? 0 : 1,
        props: {
          richText: toRichText(label),
          color,
          size: 's',
          font: BOARD_FONT,
          textAlign: 'middle',
          autoSize: false,
          w: cw,
          scale: 1,
        },
      })
      extra.push({ id: textId, type: 'text' })
      return textId
    }

    if (shape.kind === 'array') {
      // One row of touching cells with their indices underneath — the indices
      // are usually the thing being taught.
      const cells = rows[0] ?? []
      const cw = shape.w / Math.max(1, cells.length)
      const ch = Math.min(shape.h, cw * 1.05)

      for (const [i, value] of cells.entries()) {
        cell(x + i * cw, y, cw, ch, value)
        caption(x + i * cw, y + ch + 8, cw, String(i))
      }
    } else if (shape.kind === 'stack') {
      // Layers sitting on each other: a network stack, a call stack, strata.
      const rh = shape.h / Math.max(1, rows.length)
      for (const [i, row] of rows.entries()) {
        cell(x, y + i * rh, shape.w, rh, row.join(' '), { accent: i === 0 })
      }
    } else {
      // Table. First row is the header.
      const cols = Math.max(...rows.map((row) => row.length), 1)
      const cw = shape.w / cols

      // A short box divided by several rows leaves each one too thin for its
      // label, which then wraps and spills into the row below. Give every row
      // the height its longest cell actually needs and let the table grow.
      const perLine = 13 * (shape.size === 's' ? 0.8 : 1)
      const lines = (row: string[]) =>
        Math.max(...row.map((text) => Math.ceil((text.length * perLine) / Math.max(40, cw - 16))), 1)
      const heights = rows.map((row) => Math.max(MIN_ROW_H, lines(row) * 26 + 18))
      const natural = heights.reduce((sum, height) => sum + height, 0)
      const scale = natural < shape.h ? shape.h / natural : 1

      let top = y
      for (const [r, row] of rows.entries()) {
        const rh = heights[r] * scale
        for (let c = 0; c < cols; c++) {
          cell(x + c * cw, top, cw, rh, row[c] ?? '', { header: r === 0 })
        }
        top += rh
      }
    }

    if (!extra.length) return null

    // The first sub-shape stands in for the whole composite when an arrow aims
    // at it; `rects` carries the real outer bounds so it aims at the right
    // place rather than at one cell.
    const primary = extra.shift()!
    this.rects.set(primary.id, { x, y, w: shape.w, h: shape.h })
    this.composites.add(primary.id)

    if (animate) {
      this.enqueue({
        id: primary.id,
        type: primary.type,
        path: boxPath(x, y, shape.w, shape.h),
        stroke: null,
        extra,
      })
    }

    return primary.id
  }

  /**
   * A ring drawn around something, the way a teacher circles a term mid-
   * sentence. Deliberately imperfect: the radius breathes, and the stroke
   * overshoots where it started rather than closing cleanly.
   */
  private paintRing(shape: BoardShape, id: TLShapeId, offsetY: number, animate: boolean) {
    const cx = shape.x + shape.w / 2
    const cy = shape.y + offsetY + shape.h / 2
    const rx = (shape.w / 2) * 1.08
    const ry = (shape.h / 2) * 1.14

    const STEPS = 30
    const OVERSHOOT = 0.18 // fraction of a turn drawn past the start
    const start = wobble(shape.id, 'start', Math.PI)

    const points = []
    for (let i = 0; i <= STEPS * (1 + OVERSHOOT); i++) {
      const t = start + (i / STEPS) * Math.PI * 2
      const breathe = 1 + wobble(shape.id, `w${i % 7}`, 0.045)
      points.push({
        x: cx + Math.cos(t) * rx * breathe,
        y: cy + Math.sin(t) * ry * breathe,
        z: 0.5,
      })
    }

    const originX = Math.min(...points.map((p) => p.x))
    const originY = Math.min(...points.map((p) => p.y))

    this.editor.createShape({
      id,
      type: 'draw',
      x: originX,
      y: originY,
      opacity: animate ? 0 : 1,
      props: {
        color: shape.color,
        fill: 'none',
        dash: 'draw',
        size: shape.size,
        segments: [
          {
            type: 'free' as const,
            path: b64Vecs.encodePoints(
              points.map((p) => ({ x: p.x - originX, y: p.y - originY, z: p.z }))
            ),
          },
        ],
        isComplete: true,
        isClosed: false,
        isPen: false,
        scale: 1,
        scaleX: 1,
        scaleY: 1,
      },
    })

    this.rects.set(id, { x: shape.x, y: shape.y + offsetY, w: shape.w, h: shape.h })

    if (animate) {
      const local = points.map((p) => ({ x: p.x - originX, y: p.y - originY, z: p.z }))
      this.enqueue({ id, type: 'draw', path: points, stroke: { points: local } })
    }
  }


  /** Straight multi-point lines: brackets, dividers, underlines. */
  private paintLine(shape: BoardShape, id: TLShapeId, offsetY: number, animate: boolean) {
    const source = shape.points

    const origin = { x: source[0].x, y: source[0].y + offsetY }
    const indices = getIndices(source.length)

    const points: Record<string, { id: string; index: IndexKey; x: number; y: number }> = {}
    for (const [i, point] of source.entries()) {
      const key = indices[i]
      points[key] = {
        id: key,
        index: key,
        x: point.x - origin.x,
        y: point.y + offsetY - origin.y,
      }
    }

    this.editor.createShape({
      id,
      type: 'line',
      x: origin.x,
      y: origin.y,
      opacity: animate ? 0 : 1,
      props: {
        color: shape.color,
        dash: shape.dash === 'draw' ? 'solid' : shape.dash,
        size: shape.size,
        spline: 'line',
        points,
        scale: 1,
      },
    })

    this.rects.set(id, { x: origin.x, y: origin.y, w: shape.w, h: shape.h })

    if (animate) {
      this.enqueue({
        id,
        type: 'line',
        path: source.map((p) => ({ x: p.x, y: p.y + offsetY })),
        stroke: null,
      })
    }
  }

  private paintArrow(
    sceneIndex: number,
    shape: BoardShape,
    id: TLShapeId,
    offsetY: number,
    animate: boolean
  ) {
    const fromId = shape.from ? this.painted.get(this.key(sceneIndex, shape.from)) : undefined
    const toId = shape.to ? this.painted.get(this.key(sceneIndex, shape.to)) : undefined
    const fromRect = fromId ? this.rects.get(fromId) : undefined
    const toRect = toId ? this.rects.get(toId) : undefined

    // Bindings take over once they exist, but the arrow still needs a sane
    // starting geometry — and it's all we have for a free-floating arrow.
    let start = { x: shape.x, y: shape.y + offsetY }
    let end = { x: shape.x + shape.w, y: shape.y + offsetY + shape.h }

    if (fromRect && toRect) {
      start = edgePoint(fromRect, center(toRect))
      end = edgePoint(toRect, center(fromRect))
    } else if (fromRect) {
      start = edgePoint(fromRect, end)
    } else if (toRect) {
      end = edgePoint(toRect, start)
    }

    this.editor.createShape({
      id,
      type: 'arrow',
      x: start.x,
      y: start.y,
      opacity: animate ? 0 : 1,
      props: {
        kind: shape.kind === 'elbow' ? 'elbow' : 'arc',
        start: { x: 0, y: 0 },
        end: { x: end.x - start.x, y: end.y - start.y },
        // Hand-drawn connectors bow slightly; ruler-straight reads as machine.
        bend: shape.kind === 'elbow' ? 0 : wobble(shape.id, 'bend', HAND.bend),
        color: shape.color,
        fill: 'none',
        dash: shape.dash,
        size: shape.size === 'xl' ? 'l' : shape.size,
        arrowheadStart: 'none',
        arrowheadEnd: 'arrow',
        font: BOARD_FONT,
        richText: toRichText(shape.text ?? ''),
        labelPosition: 0.5,
        labelColor: shape.color,
        scale: 1,
        elbowMidPoint: 0.5,
      },
    })

    for (const [terminal, target] of [
      ['start', fromId],
      ['end', toId],
    ] as const) {
      if (!target || this.composites.has(target)) continue
      this.editor.createBinding({
        type: 'arrow',
        fromId: id,
        toId: target,
        props: {
          terminal,
          normalizedAnchor: { x: 0.5, y: 0.5 },
          isPrecise: false,
          isExact: false,
          snap: 'none',
        },
      })
    }

    if (animate) {
      this.enqueue({ id, type: 'arrow', path: [start, end], stroke: null })
    }
  }

  /**
   * Hands a newly created shape to the pen. Rather than fading in from nowhere,
   * the shape is inked in while a visible cursor traces its outline, so the
   * viewer's eye has something to follow — the way it would follow a hand.
   */
  private reveal(
    id: TLShapeId,
    type: TraceJob['type'],
    path: Vec2[],
    animate: boolean,
    extra?: TraceJob['extra']
  ) {
    if (!animate || path.length < 2) {
      if (animate) {
        this.setShape({ id, type, opacity: 1 })
        for (const part of extra ?? []) this.setShape({ ...part, opacity: 1 })
      }
      return
    }
    this.enqueue({ id, type, path, stroke: null, extra })
  }

  /**
   * Hands the painter a resolved image.
   *
   * Lookups routinely finish after the shape was due — a search, a proxied
   * fetch and a decode take seconds, and the model often places the picture
   * early in a scene. So a shape that arrives first is drawn as a placeholder
   * and swapped here the moment the real image lands. Without this the
   * placeholder is simply what you get, every time.
   */
  addImage(
    query: string,
    result: { src: string; width: number; height: number; animated?: boolean }
  ) {
    const key = query.trim().toLowerCase()
    this.images.set(key, result)

    const pending = this.placeholders.get(key)
    if (!pending) return
    this.placeholders.delete(key)

    this.editor.deleteShapes([pending.id])
    this.painted.delete(pending.key)
    this.rects.delete(pending.id)

    // Already "drawn" once, so no second trace — just put the picture in place.
    this.paint(pending.sceneIndex, pending.shape, pending.siblings, false)
  }

  /**
   * tldraw's `updateShape` is a discriminated union over `type`, so a value
   * typed as a union of shape types can't satisfy it directly. Widening once
   * here beats casting at every trace call site.
   */
  private setShape(update: {
    id: TLShapeId
    type: TraceJob['type']
    opacity?: number
    props?: Record<string, unknown>
  }) {
    this.editor.updateShape(update as Parameters<Editor['updateShape']>[0])
  }

  private enqueue(job: TraceJob) {
    this.queue.push(job)
    this.inFlight.set(job.id, job)
    if (!this.tracing) void this.drainQueue()
  }

  /** Completes every pending and in-progress trace immediately. */
  private flushTraces() {
    for (const frame of this.frames) cancelAnimationFrame(frame)
    this.frames.clear()
    this.queue.length = 0

    for (const job of this.inFlight.values()) {
      const props = job.stroke
        ? {
            segments: [
              { type: 'free' as const, path: b64Vecs.encodePoints(job.stroke.points) },
            ],
          }
        : undefined
      this.setShape({ id: job.id, type: job.type, opacity: 1, ...(props ? { props } : {}) })
      for (const part of job.extra ?? []) {
        this.setShape({ id: part.id, type: part.type, opacity: 1 })
      }
    }

    this.inFlight.clear()
    this.tracing = false
  }

  /**
   * Traces one shape at a time. A teacher draws one thing then the next; two
   * shapes appearing at once reads as a machine again. When the queue backs up
   * behind the narration, each trace speeds up rather than falling behind.
   *
   * `speed` multiplies the duration, so a deeper queue means a shorter trace.
   * It used to divide it, which meant a busy board drew *slower* and fell
   * further behind the voice with every shape — invisible at nine shapes a
   * scene and very visible at twenty.
   */
  private async drainQueue() {
    this.tracing = true

    while (this.queue.length) {
      const job = this.queue.shift()!
      // Deeper cap than before, because a scene with a diagram queues a node
      // and its arrows on the same word.
      const rush = Math.min(8, this.queue.length)
      await this.trace(job, 1 / (1 + rush * 0.55))
    }

    this.tracing = false
  }

  private trace(job: TraceJob, speed: number) {
    return new Promise<void>((resolve) => {
      const length = pathLength(job.path)
      const duration = Math.max(90, Math.min(950, length * 1.15) * speed)
      const start = performance.now()

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = t * t * (3 - 2 * t) // smoothstep: eases both ends

        // Stroke kinds grow their real points, so the line genuinely extends;
        // everything else fades in over the same beat.
        if (job.stroke) {
          const take = Math.max(2, Math.ceil(job.stroke.points.length * eased))
          this.setShape({
            id: job.id,
            type: job.type,
            opacity: 1,
            props: {
              segments: [
                {
                  type: 'free' as const,
                  path: b64Vecs.encodePoints(job.stroke.points.slice(0, take)),
                },
              ],
            },
          })
        } else {
          this.setShape({ id: job.id, type: job.type, opacity: eased })
          for (const part of job.extra ?? []) {
            this.setShape({ id: part.id, type: part.type, opacity: eased })
          }
        }

        if (t < 1) {
          const frame = requestAnimationFrame(step)
          this.frames.add(frame)
          return
        }

        this.setShape({ id: job.id, type: job.type, opacity: 1 })
        for (const part of job.extra ?? []) {
          this.setShape({ id: part.id, type: part.type, opacity: 1 })
        }
        this.inFlight.delete(job.id)
        resolve()
      }

      const frame = requestAnimationFrame(step)
      this.frames.add(frame)
    })
  }

}

function center(rect: Rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
}

/** Where the line from `rect`'s centre towards `towards` crosses its border. */
function edgePoint(rect: Rect, towards: { x: number; y: number }) {
  const c = center(rect)
  const dx = towards.x - c.x
  const dy = towards.y - c.y
  if (dx === 0 && dy === 0) return c

  const halfW = Math.max(1, rect.w / 2)
  const halfH = Math.max(1, rect.h / 2)
  const scale = Math.min(
    dx === 0 ? Infinity : halfW / Math.abs(dx),
    dy === 0 ? Infinity : halfH / Math.abs(dy)
  )

  return { x: c.x + dx * scale, y: c.y + dy * scale }
}
