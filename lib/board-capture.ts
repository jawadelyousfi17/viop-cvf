'use client'

import {
  renderPlaintextFromRichText,
  type Editor,
  type TLShape,
  type TLShapeId,
} from 'tldraw'
import { COLORS, DASHES, FILLS, SIZES, type BoardShape, type ShapeKind } from './lesson'

/**
 * Reading a board back out of tldraw.
 *
 * The authoring tool works the other way round from the player: instead of
 * turning a lesson into shapes, it turns whatever someone drew into a lesson.
 * That means going backwards through the painter's mapping — tldraw's `geo`
 * styles into board kinds, its rich text into plain strings, its bindings into
 * the `from`/`to` an arrow needs.
 *
 * Anything tldraw can draw that the board has no word for is simply dropped,
 * which is better than emitting a shape the player would render as something
 * else entirely.
 */

/** tldraw's `geo` styles, mapped back onto board kinds. */
const GEO_TO_KIND: Record<string, ShapeKind> = {
  rectangle: 'box',
  ellipse: 'ellipse',
  diamond: 'diamond',
  triangle: 'triangle',
  hexagon: 'hexagon',
  star: 'star',
  cloud: 'cloud',
  oval: 'oval',
  heart: 'heart',
  pentagon: 'pentagon',
  octagon: 'octagon',
  trapezoid: 'trapezoid',
  rhombus: 'rhombus',
  'arrow-right': 'arrowright',
  'arrow-left': 'arrowleft',
  'arrow-up': 'arrowup',
  'arrow-down': 'arrowdown',
}

/**
 * What a shape means on the board, when it isn't obvious from the drawing.
 *
 * A photograph and a chart have no tldraw equivalent to draw — they are a
 * search query and a dataset. So the tool tags a shape through tldraw's own
 * `meta` field and the tag wins over whatever was drawn.
 */
export interface BoardMeta {
  boardKind?: ShapeKind
  /** Chart data, as `label,value` lines. */
  data?: string
}

/** The board colour nearest a tldraw one. */
function boardColor(color: unknown): BoardShape['color'] {
  const name = String(color)
  if (name === 'white') return 'grey'
  return (COLORS as readonly string[]).includes(name) ? (name as BoardShape['color']) : 'black'
}

function pick<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]): T[number] {
  const name = String(value)
  return (options as readonly string[]).includes(name) ? name : fallback
}

/**
 * Converts one tldraw shape into a board shape, or null if the board has no
 * word for it.
 *
 * @param offsetY the scene's own origin on the shared canvas, subtracted so
 *   the result is in scene-local coordinates.
 */
export function toBoardShape(
  editor: Editor,
  shape: TLShape,
  options: { id: string; at: number; anchor: string; offsetY: number; bound?: { from: string | null; to: string | null } }
): BoardShape | null {
  const props = shape.props as Record<string, unknown>
  const meta = (shape.meta ?? {}) as BoardMeta

  const bounds = editor.getShapePageBounds(shape.id)
  if (!bounds) return null

  const base: BoardShape = {
    id: options.id,
    kind: 'box',
    text: '',
    x: Math.round(bounds.x),
    y: Math.round(bounds.y - options.offsetY),
    w: Math.round(bounds.w),
    h: Math.round(bounds.h),
    from: options.bound?.from ?? null,
    to: options.bound?.to ?? null,
    color: boardColor(props.color),
    fill: pick(props.fill, FILLS, 'none') as BoardShape['fill'],
    size: pick(props.size, SIZES, 'm') as BoardShape['size'],
    dash: pick(props.dash, DASHES, 'draw') as BoardShape['dash'],
    at: options.at,
    anchor: options.anchor,
    points: [],
    data: [],
    parent: null,
  }

  const label = props.richText
    ? renderPlaintextFromRichText(editor, props.richText as never).trim()
    : ''

  switch (shape.type) {
    case 'geo': {
      base.kind = GEO_TO_KIND[String(props.geo)] ?? 'box'
      base.text = label
      break
    }
    case 'text': {
      base.kind = 'text'
      base.text = label
      break
    }
    case 'note': {
      base.kind = 'note'
      base.text = label
      break
    }
    case 'arrow': {
      base.kind = 'arrow'
      base.text = label
      break
    }
    case 'line':
    case 'draw':
    case 'highlight': {
      // Geometry rather than a box: read the real vertices, in page space.
      const geometry = editor.getShapeGeometry(shape)
      const transform = editor.getShapePageTransform(shape.id)
      const vertices = geometry.vertices ?? []
      if (vertices.length < 2 || !transform) return null

      // A freehand stroke can be a thousand points; the board caps them and
      // more than a few dozen is invisible detail anyway.
      const step = Math.max(1, Math.ceil(vertices.length / 40))
      base.kind = shape.type === 'highlight' ? 'highlight' : shape.type === 'line' ? 'line' : 'curve'
      base.points = vertices
        .filter((_, i) => i % step === 0 || i === vertices.length - 1)
        .map((point) => {
          const at = transform.applyToPoint(point)
          return { x: Math.round(at.x), y: Math.round(at.y - options.offsetY) }
        })
      break
    }
    default:
      return null
  }

  // A tag beats the drawing: this is how a rectangle becomes a photograph.
  if (meta.boardKind) {
    base.kind = meta.boardKind
    if (meta.data) {
      base.data = meta.data
        .split('\n')
        .map((line) => {
          const at = line.lastIndexOf(',')
          return { label: line.slice(0, at).trim(), value: Number(line.slice(at + 1)) }
        })
        .filter((point) => point.label && Number.isFinite(point.value))
    }
  }

  return base
}

/**
 * Reads a whole scene off the canvas.
 *
 * Ids are assigned here rather than reusing tldraw's, because an arrow's
 * `from`/`to` have to name shapes in the emitted lesson — so the mapping from
 * tldraw id to board id has to exist before any arrow is converted.
 */
export function captureScene(
  editor: Editor,
  shapes: TLShape[],
  timings: Map<string, { at: number; anchor: string }>,
  offsetY = 0
): BoardShape[] {
  const ids = new Map<TLShapeId, string>()
  for (const [index, shape] of shapes.entries()) ids.set(shape.id, `s${index + 1}`)

  const out: BoardShape[] = []
  for (const shape of shapes) {
    const timing = timings.get(shape.id) ?? { at: 0.5, anchor: '' }

    let bound: { from: string | null; to: string | null } | undefined
    if (shape.type === 'arrow') {
      const bindings = editor.getBindingsFromShape(shape.id, 'arrow') as {
        toId: TLShapeId
        props: { terminal: 'start' | 'end' }
      }[]
      const start = bindings.find((b) => b.props.terminal === 'start')
      const end = bindings.find((b) => b.props.terminal === 'end')
      bound = {
        from: start ? ids.get(start.toId) ?? null : null,
        to: end ? ids.get(end.toId) ?? null : null,
      }
    }

    const converted = toBoardShape(editor, shape, {
      id: ids.get(shape.id)!,
      at: timing.at,
      anchor: timing.anchor,
      offsetY,
      bound,
    })
    if (converted) out.push(converted)
  }

  return out.sort((a, b) => a.at - b.at)
}
