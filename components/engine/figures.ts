import type { BoardShape } from '@/lib/lesson'
import type { Point } from './ink'

/**
 * The shapes a lesson can ask for that a mindmap never did.
 *
 * The map engine only ever needed a box, an ellipse and a line, because a map
 * is boxes and lines. A lesson board is a wider language — diamonds for
 * decisions, a stack for layers, an array with its indices under it — and all
 * of it used to be tldraw's job. This is the geometry half of taking it back:
 * every kind resolved to either a polygon (drawn with the same wobbling ink as
 * everything else) or, for the composites, to the several plain shapes it was
 * always made of.
 *
 * Everything here is pure: a kind and a box in, points or shapes out. Nothing
 * measures text, nothing touches the DOM, and nothing knows what a scene is.
 */

interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** A regular polygon inscribed in the box, first vertex at the top. */
function regular(box: Box, sides: number, turn = -Math.PI / 2): Point[] {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  return Array.from({ length: sides }, (_, i) => {
    const angle = turn + (i * 2 * Math.PI) / sides
    return { x: cx + (box.w / 2) * Math.cos(angle), y: cy + (box.h / 2) * Math.sin(angle) }
  })
}

/** A star: outer points alternating with inner ones. */
function star(box: Box, points = 5, inner = 0.42): Point[] {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  return Array.from({ length: points * 2 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI) / points
    const scale = i % 2 === 0 ? 1 : inner
    return {
      x: cx + (box.w / 2) * scale * Math.cos(angle),
      y: cy + (box.h / 2) * scale * Math.sin(angle),
    }
  })
}

/**
 * A block arrow pointing one of four ways.
 *
 * The shaft is half the short dimension and the head a third of the long one,
 * which is the proportion that still reads as an arrow when the model gives it
 * a box that is nearly square.
 */
function blockArrow(box: Box, dir: 'right' | 'left' | 'up' | 'down'): Point[] {
  const { x, y, w, h } = box
  const horizontal = dir === 'right' || dir === 'left'
  const head = horizontal ? Math.min(w * 0.38, w - 4) : Math.min(h * 0.38, h - 4)
  const shaft = horizontal ? h * 0.25 : w * 0.25

  if (horizontal) {
    const tipX = dir === 'right' ? x + w : x
    const baseX = dir === 'right' ? x + w - head : x + head
    const tailX = dir === 'right' ? x : x + w
    return [
      { x: tailX, y: y + h / 2 - shaft },
      { x: baseX, y: y + h / 2 - shaft },
      { x: baseX, y },
      { x: tipX, y: y + h / 2 },
      { x: baseX, y: y + h },
      { x: baseX, y: y + h / 2 + shaft },
      { x: tailX, y: y + h / 2 + shaft },
    ]
  }

  const tipY = dir === 'down' ? y + h : y
  const baseY = dir === 'down' ? y + h - head : y + head
  const tailY = dir === 'down' ? y : y + h
  return [
    { x: x + w / 2 - shaft, y: tailY },
    { x: x + w / 2 - shaft, y: baseY },
    { x, y: baseY },
    { x: x + w / 2, y: tipY },
    { x: x + w, y: baseY },
    { x: x + w / 2 + shaft, y: baseY },
    { x: x + w / 2 + shaft, y: tailY },
  ]
}

/** A heart, sampled from the usual parametric curve and squeezed into the box. */
function heart(box: Box): Point[] {
  return Array.from({ length: 36 }, (_, i) => {
    const t = (i / 36) * Math.PI * 2
    const hx = 16 * Math.sin(t) ** 3
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
    return {
      x: box.x + box.w / 2 + (hx / 32) * box.w,
      y: box.y + box.h / 2 + (hy / 30) * box.h,
    }
  })
}

/**
 * A cloud: lobes around the box, sampled densely enough that the ink's own
 * wobble reads as the bumps rather than fighting them.
 */
function cloud(box: Box): Point[] {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  return Array.from({ length: 48 }, (_, i) => {
    const angle = (i / 48) * Math.PI * 2
    const lobe = 1 + 0.13 * Math.sin(angle * 5) + 0.06 * Math.sin(angle * 9)
    return { x: cx + (box.w / 2) * lobe * Math.cos(angle), y: cy + (box.h / 2) * lobe * Math.sin(angle) }
  })
}

/**
 * The outline for a kind, or null when it is not a polygon at all.
 *
 * Null means "somebody else draws this" — a box, an ellipse, an image, a
 * composite — not that the kind is unknown.
 */
export function polygonFor(kind: BoardShape['kind'], box: Box): Point[] | null {
  const { x, y, w, h } = box

  switch (kind) {
    case 'diamond':
    case 'rhombus':
      return [
        { x: x + w / 2, y },
        { x: x + w, y: y + h / 2 },
        { x: x + w / 2, y: y + h },
        { x, y: y + h / 2 },
      ]
    case 'triangle':
      return [
        { x: x + w / 2, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ]
    case 'trapezoid':
      return [
        { x: x + w * 0.2, y },
        { x: x + w * 0.8, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ]
    case 'pentagon':
      return regular(box, 5)
    case 'hexagon':
      // Flat-topped, which is how a hexagon is drawn on a whiteboard.
      return regular(box, 6, 0)
    case 'octagon':
      return regular(box, 8, -Math.PI / 8)
    case 'star':
      return star(box)
    case 'heart':
      return heart(box)
    case 'cloud':
      return cloud(box)
    case 'arrowright':
      return blockArrow(box, 'right')
    case 'arrowleft':
      return blockArrow(box, 'left')
    case 'arrowup':
      return blockArrow(box, 'up')
    case 'arrowdown':
      return blockArrow(box, 'down')
    default:
      return null
  }
}

/** Splits a composite's text into rows of cells: newlines are rows, pipes columns. */
export function parseGrid(text: string): string[][] {
  return text
    .split('\n')
    .map((row) => row.split('|').map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean))
}

const COMPOSITES = new Set<BoardShape['kind']>(['table', 'array', 'stack'])

export const isComposite = (kind: BoardShape['kind']) => COMPOSITES.has(kind)

/**
 * A table, an array or a stack as the several shapes it is really made of.
 *
 * Drawn as plain boxes and text rather than as a kind of its own, for the same
 * reason the painter did it this way: a table is a grid of cells, and a cell is
 * a box with a word in it. Doing it here means every one of them inherits the
 * wobble, the fills and the label wrapping without a second implementation.
 *
 * The ids are derived from the parent's, so a scene painted twice produces the
 * same ids and the same wobble — the ink is seeded from the id, and cells that
 * re-seed on every render would shimmer.
 */
export function expandComposite(shape: BoardShape): BoardShape[] {
  const rows = parseGrid(shape.text)
  if (!rows.length) return []

  const out: BoardShape[] = []
  const cellSize = shape.size === 'xl' ? 'l' : shape.size

  const cell = (
    id: string,
    box: Box,
    text: string,
    opts: { header?: boolean; muted?: boolean } = {}
  ) => {
    out.push({
      ...shape,
      id: `${shape.id}~${id}`,
      kind: 'box',
      text,
      ...box,
      from: null,
      to: null,
      points: [],
      data: [],
      parent: null,
      color: opts.header ? shape.color : 'black',
      fill: opts.header ? 'semi' : 'none',
      size: cellSize,
    })
  }

  const caption = (id: string, box: Box, text: string) => {
    out.push({
      ...shape,
      id: `${shape.id}~${id}`,
      kind: 'text',
      text,
      ...box,
      from: null,
      to: null,
      points: [],
      data: [],
      parent: null,
      color: 'grey',
      fill: 'none',
      size: 's',
    })
  }

  if (shape.kind === 'array') {
    // One row of touching cells with their indices underneath — the indices are
    // usually the thing being taught.
    const cells = rows[0] ?? []
    const cw = shape.w / Math.max(1, cells.length)
    const ch = Math.min(shape.h, cw * 1.05)

    cells.forEach((value, i) => {
      cell(`c${i}`, { x: shape.x + i * cw, y: shape.y, w: cw, h: ch }, value)
      caption(`i${i}`, { x: shape.x + i * cw, y: shape.y + ch + 6, w: cw, h: 26 }, String(i))
    })
    return out
  }

  if (shape.kind === 'stack') {
    // Layers sitting on each other: a network stack, a call stack, strata.
    const rh = shape.h / Math.max(1, rows.length)
    rows.forEach((row, i) => {
      cell(`r${i}`, { x: shape.x, y: shape.y + i * rh, w: shape.w, h: rh }, row.join(' '), {
        header: i === 0,
      })
    })
    return out
  }

  // A table: the first row is the heading, and every row after it lines up
  // under it.
  const columns = Math.max(...rows.map((row) => row.length))
  const cw = shape.w / Math.max(1, columns)
  const rh = shape.h / rows.length

  rows.forEach((row, r) => {
    for (let c = 0; c < columns; c++) {
      cell(
        `r${r}c${c}`,
        { x: shape.x + c * cw, y: shape.y + r * rh, w: cw, h: rh },
        row[c] ?? '',
        { header: r === 0 }
      )
    }
  })

  return out
}
