import { SCENE_H, SCENE_W, type BoardShape, type Scene } from './lesson'
import { wrapText } from './canvas-draw'

/**
 * Shapes that are geometry rather than blocks: they connect or annotate other
 * shapes, so they are never pushed around and never claim space.
 */
const CONNECTORS = new Set([
  'arrow',
  'elbow',
  'line',
  'curve',
  'highlight',
  'ring',
])

export interface Placed {
  shape: BoardShape
  /** Where it will actually be drawn, after measuring and de-overlapping. */
  x: number
  y: number
  w: number
  h: number
  /** Pre-wrapped label, so drawing never re-measures. */
  lines: string[]
  lineHeight: number
}

const FONT_PX: Record<BoardShape['size'], number> = { s: 15, m: 19, l: 26, xl: 36 }

/** One hand for the whole board — see BOARD_FONT. */
const FAMILY = "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive"

export function fontFor(shape: BoardShape, scale = 1) {
  return `${FONT_PX[shape.size] * scale}px ${FAMILY}`
}

/**
 * Measures every shape's real footprint, then pushes overlapping ones apart.
 *
 * This is the reason the canvas engine exists. Handing coordinates to a shape
 * library means the box is declared before the text is measured, so a label
 * that wraps to three lines silently grows past the space reserved for it and
 * lands on its neighbour. Here the text is measured first and the layout is
 * resolved against what will actually be painted.
 */
export function layoutScene(ctx: CanvasRenderingContext2D, scene: Scene): Placed[] {
  const placed: Placed[] = scene.shapes.map((shape) => {
    if (CONNECTORS.has(shape.kind)) {
      return { shape, x: shape.x, y: shape.y, w: shape.w, h: shape.h, lines: [], lineHeight: 0 }
    }

    const isNote = shape.kind === 'note'
    const isIcon = shape.kind === 'icon'
    let w = isNote ? 200 : Math.max(40, shape.w)

    ctx.font = fontFor(shape, isIcon ? 2.4 : 1)
    const padding = shape.kind === 'text' || shape.kind === 'label' || isIcon ? 4 : 22
    const wrapped = shape.text ? wrapText(ctx, shape.text, w - padding * 2) : null

    let h = isNote ? 200 : Math.max(36, shape.h)
    if (wrapped) {
      // Grow to fit rather than letting the text spill out of the shape.
      h = Math.max(h, wrapped.height + padding * 2)
      if (shape.kind === 'label') h = Math.max(h, wrapped.height + 34) // room for the rule
      if (shape.kind === 'text' || shape.kind === 'label' || isIcon) {
        w = Math.max(w, Math.min(SCENE_W * 0.5, wrapped.width + padding * 2))
      }
    }

    return {
      shape,
      x: shape.x,
      y: shape.y,
      w,
      h,
      lines: wrapped?.lines ?? [],
      lineHeight: wrapped?.lineHeight ?? 0,
    }
  })

  separate(placed)
  centre(placed)
  return placed
}

const GAP = 18

/**
 * Nudges overlapping blocks apart along whichever axis needs the smaller
 * push, a few passes until it settles. Deliberately gentle: the model's
 * arrangement carries meaning, so this corrects collisions rather than
 * re-laying-out the scene.
 */
function separate(placed: Placed[]) {
  const blocks = placed.filter((p) => !CONNECTORS.has(p.shape.kind))

  for (let pass = 0; pass < 24; pass++) {
    let moved = false

    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i]
        const b = blocks[j]

        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + GAP
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + GAP
        if (overlapX <= 0 || overlapY <= 0) continue

        moved = true
        // Push along the cheaper axis so the arrangement keeps its shape.
        if (overlapY < overlapX) {
          const shift = overlapY / 2
          if (a.y + a.h / 2 < b.y + b.h / 2) {
            a.y -= shift
            b.y += shift
          } else {
            a.y += shift
            b.y -= shift
          }
        } else {
          const shift = overlapX / 2
          if (a.x + a.w / 2 < b.x + b.w / 2) {
            a.x -= shift
            b.x += shift
          } else {
            a.x += shift
            b.x -= shift
          }
        }
      }
    }

    if (!moved) break
  }
}

/** Re-centres the resolved block in the scene box. */
function centre(placed: Placed[]) {
  if (!placed.length) return

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const p of placed) {
    const points = p.shape.points
    if (CONNECTORS.has(p.shape.kind) && points.length) {
      for (const point of points) {
        minX = Math.min(minX, point.x)
        minY = Math.min(minY, point.y)
        maxX = Math.max(maxX, point.x)
        maxY = Math.max(maxY, point.y)
      }
      continue
    }
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x + p.w)
    maxY = Math.max(maxY, p.y + p.h)
  }

  if (!Number.isFinite(minX)) return

  const dx = (SCENE_W - (maxX - minX)) / 2 - minX
  const dy = (SCENE_H - (maxY - minY)) / 2 - minY

  for (const p of placed) {
    p.x += dx
    p.y += dy
    for (const point of p.shape.points) {
      point.x += dx
      point.y += dy
    }
  }
}

/** Looks a placed shape up by its board id, for aiming arrows. */
export function byId(placed: Placed[]) {
  return new Map(placed.map((p) => [p.shape.id, p]))
}

export { CONNECTORS }
