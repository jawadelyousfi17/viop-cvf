'use client'

import type { BoardShape } from '@/lib/lesson'
import {
  arrowHead,
  drawText,
  roughEllipse,
  roughLine,
  roughPath,
  roughRect,
  setDash,
  wobble,
  type Point,
} from '@/lib/canvas-draw'
import { CONNECTORS, byId, fontFor, type Placed } from '@/lib/canvas-layout'

/** tldraw's palette, kept so the two engines look like the same hand. */
const COLORS: Record<string, string> = {
  black: '#1d1d1d',
  grey: '#9fa8b2',
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

const STROKE: Record<BoardShape['size'], number> = { s: 2, m: 3, l: 4.5, xl: 6 }

function colorOf(shape: BoardShape) {
  return COLORS[shape.color] ?? COLORS.black
}

/** Fill styles, drawn rather than declared. */
function paintFill(ctx: CanvasRenderingContext2D, p: Placed, path: () => void) {
  const { fill } = p.shape
  if (fill === 'none') return

  const colour = colorOf(p.shape)
  ctx.save()
  path()
  ctx.clip()

  if (fill === 'semi') {
    ctx.globalAlpha = 0.12
    ctx.fillStyle = colour
    ctx.fillRect(p.x - 8, p.y - 8, p.w + 16, p.h + 16)
  } else if (fill === 'solid' || fill === 'fill') {
    ctx.globalAlpha = fill === 'solid' ? 0.22 : 0.9
    ctx.fillStyle = colour
    ctx.fillRect(p.x - 8, p.y - 8, p.w + 16, p.h + 16)
  } else {
    // pattern / lined-fill: hatching, drawn as strokes so it reads as marker.
    ctx.globalAlpha = 0.32
    ctx.strokeStyle = colour
    ctx.lineWidth = 1.6
    ctx.beginPath()
    for (let d = -p.h; d < p.w; d += 11) {
      ctx.moveTo(p.x + d, p.y + p.h)
      ctx.lineTo(p.x + d + p.h, p.y)
    }
    ctx.stroke()
  }

  ctx.restore()
}

/** Anchor point on a block's border, aimed at `towards`. */
function edgePoint(p: Placed, towards: Point): Point {
  const cx = p.x + p.w / 2
  const cy = p.y + p.h / 2
  const dx = towards.x - cx
  const dy = towards.y - cy
  if (!dx && !dy) return { x: cx, y: cy }

  const scale = Math.min(
    dx === 0 ? Infinity : p.w / 2 / Math.abs(dx),
    dy === 0 ? Infinity : p.h / 2 / Math.abs(dy)
  )
  return { x: cx + dx * scale, y: cy + dy * scale }
}

export interface RenderOptions {
  /** Per-shape reveal progress, 0-1, keyed by board shape id. */
  progress: Map<string, number>
  /** Resolved images, keyed by their search query. */
  images: Map<string, HTMLImageElement>
}

/** Paints one scene's placed shapes at their current reveal progress. */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  placed: Placed[],
  options: RenderOptions
) {
  const index = byId(placed)

  for (const p of placed) {
    const t = options.progress.get(p.shape.id) ?? 0
    if (t <= 0) continue

    ctx.save()
    ctx.globalAlpha = Math.min(1, t * 1.6)
    ctx.strokeStyle = colorOf(p.shape)
    ctx.fillStyle = colorOf(p.shape)
    ctx.lineWidth = STROKE[p.shape.size]
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    setDash(ctx, p.shape.dash)

    // A shape tilts a touch, the way nothing drawn by hand sits square.
    const cx = p.x + p.w / 2
    const cy = p.y + p.h / 2
    ctx.translate(cx, cy)
    ctx.rotate(wobble(p.shape.id, 'rot', p.shape.kind === 'note' ? 0.035 : 0.008))
    ctx.translate(-cx, -cy)

    draw(ctx, p, index, options, t)
    ctx.restore()
  }
}

function draw(
  ctx: CanvasRenderingContext2D,
  p: Placed,
  index: Map<string, Placed>,
  options: RenderOptions,
  t: number
) {
  const s = p.shape
  const seed = s.id

  switch (s.kind) {
    case 'text':
    case 'icon': {
      ctx.font = fontFor(s, s.kind === 'icon' ? 2.4 : 1)
      writeLines(ctx, p, p.x + p.w / 2, p.y + (p.h - p.lines.length * p.lineHeight) / 2, t)
      return
    }

    case 'label': {
      ctx.font = fontFor(s)
      const textH = p.lines.length * p.lineHeight
      writeLines(ctx, p, p.x + p.w / 2, p.y + 2, t)
      // The dashed rule under the lettering — the signature of a real board.
      if (t > 0.55) {
        setDash(ctx, 'dashed', 0.7)
        ctx.lineWidth = 2
        const ruleY = p.y + textH + 12
        roughLine(
          ctx,
          { x: p.x + 4, y: ruleY },
          { x: p.x + p.w * 0.94 + wobble(seed, 'rule', 8), y: ruleY + wobble(seed, 'tilt', 2) },
          `${seed}rule`,
          1
        )
      }
      return
    }

    case 'note': {
      ctx.save()
      ctx.setLineDash([])
      ctx.fillStyle = '#fef3bd'
      ctx.shadowColor = 'rgba(24,32,63,0.18)'
      ctx.shadowBlur = 14
      ctx.shadowOffsetY = 5
      ctx.fillRect(p.x, p.y, p.w, p.h)
      ctx.restore()
      ctx.fillStyle = COLORS.black
      ctx.font = fontFor(s)
      writeLines(ctx, p, p.x + p.w / 2, p.y + (p.h - p.lines.length * p.lineHeight) / 2, t)
      return
    }

    case 'image': {
      const image = options.images.get(s.text.trim().toLowerCase())
      if (image?.complete && image.naturalWidth) {
        // Fit the real aspect ratio inside the reserved box.
        const ratio = image.naturalWidth / image.naturalHeight
        let w = p.w
        let h = p.w / ratio
        if (h > p.h) {
          h = p.h
          w = p.h * ratio
        }
        const ix = p.x + (p.w - w) / 2
        const iy = p.y + (p.h - h) / 2
        ctx.save()
        ctx.setLineDash([])
        ctx.shadowColor = 'rgba(24,32,63,0.20)'
        ctx.shadowBlur = 18
        ctx.shadowOffsetY = 6
        ctx.drawImage(image, ix, iy, w, h)
        ctx.restore()
      } else {
        setDash(ctx, 'dashed')
        ctx.strokeStyle = COLORS.grey
        roughRect(ctx, p.x, p.y, p.w, p.h, seed)
      }
      return
    }

    case 'arrow':
    case 'elbow': {
      const from = s.from ? index.get(s.from) : undefined
      const to = s.to ? index.get(s.to) : undefined

      let start: Point = { x: p.x, y: p.y }
      let end: Point = { x: p.x + p.w, y: p.y + p.h }
      if (from && to) {
        start = edgePoint(from, { x: to.x + to.w / 2, y: to.y + to.h / 2 })
        end = edgePoint(to, { x: from.x + from.w / 2, y: from.y + from.h / 2 })
      } else if (from) start = edgePoint(from, end)
      else if (to) end = edgePoint(to, start)

      // Reveal by drawing only as far along as the progress has reached.
      const head = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t }

      if (s.kind === 'elbow') {
        const mid = { x: head.x, y: start.y }
        roughPath(ctx, [start, mid, head], seed)
      } else {
        roughLine(ctx, start, head, seed)
      }

      if (t > 0.92) {
        ctx.save()
        ctx.setLineDash([])
        arrowHead(ctx, start, end, 8 + STROKE[s.size] * 1.6)
        ctx.restore()
      }

      if (s.text && t > 0.6) {
        const mx = (start.x + end.x) / 2
        const my = (start.y + end.y) / 2
        ctx.save()
        ctx.setLineDash([])
        ctx.font = fontFor(s)
        const width = ctx.measureText(s.text).width
        // Knock a hole in the line so the label is readable over it.
        ctx.fillStyle = '#f7f8fa'
        ctx.fillRect(mx - width / 2 - 7, my - 13, width + 14, 26)
        ctx.fillStyle = colorOf(s)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(s.text, mx, my)
        ctx.restore()
      }
      return
    }

    case 'ring': {
      roughEllipse(ctx, p.x + p.w / 2, p.y + p.h / 2, (p.w / 2) * 1.06, (p.h / 2) * 1.12, seed)
      return
    }

    case 'highlight': {
      ctx.save()
      ctx.setLineDash([])
      ctx.globalAlpha = 0.34
      ctx.lineWidth = 22
      ctx.lineCap = 'butt'
      roughPath(ctx, revealPoints(s.points, t), seed, 1)
      ctx.restore()
      return
    }

    case 'curve':
    case 'line':
    case 'laser': {
      if (s.kind === 'laser') ctx.globalAlpha *= 0.75
      roughPath(ctx, revealPoints(s.points, t), seed, s.kind === 'curve' ? 2 : 1)
      return
    }

    case 'axes': {
      roughPath(
        ctx,
        [
          { x: p.x, y: p.y },
          { x: p.x, y: p.y + p.h },
          { x: p.x + p.w, y: p.y + p.h },
        ],
        seed,
        1
      )
      return
    }

    default: {
      // Every geo kind: an outline plus its centred label.
      const round = ['ellipse', 'oval', 'cloud', 'heart', 'octagon'].includes(s.kind)
      const path = () => {
        ctx.beginPath()
        if (round) ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, p.w / 2, p.h / 2, 0, 0, Math.PI * 2)
        else ctx.rect(p.x, p.y, p.w, p.h)
      }
      paintFill(ctx, p, path)

      if (round) roughEllipse(ctx, p.x + p.w / 2, p.y + p.h / 2, p.w / 2, p.h / 2, seed)
      else roughRect(ctx, p.x, p.y, p.w, p.h, seed)

      if (s.kind === 'xbox') {
        roughLine(ctx, { x: p.x, y: p.y }, { x: p.x + p.w, y: p.y + p.h }, `${seed}x1`, 1)
        roughLine(ctx, { x: p.x + p.w, y: p.y }, { x: p.x, y: p.y + p.h }, `${seed}x2`, 1)
      }
      if (s.kind === 'check') {
        roughPath(
          ctx,
          [
            { x: p.x + p.w * 0.22, y: p.y + p.h * 0.52 },
            { x: p.x + p.w * 0.42, y: p.y + p.h * 0.74 },
            { x: p.x + p.w * 0.8, y: p.y + p.h * 0.26 },
          ],
          `${seed}ck`,
          1
        )
      }

      if (p.lines.length) {
        ctx.save()
        ctx.setLineDash([])
        ctx.font = fontFor(s)
        writeLines(ctx, p, p.x + p.w / 2, p.y + (p.h - p.lines.length * p.lineHeight) / 2, t)
        ctx.restore()
      }
    }
  }
}

/** Writes the pre-wrapped lines, revealing them progressively. */
function writeLines(ctx: CanvasRenderingContext2D, p: Placed, x: number, y: number, t: number) {
  ctx.save()
  ctx.setLineDash([])
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const shown = Math.max(1, Math.ceil(p.lines.length * Math.min(1, t * 1.35)))
  for (let i = 0; i < shown; i++) {
    ctx.fillText(p.lines[i], x, y + i * p.lineHeight)
  }
  ctx.restore()
}

/** The portion of a stroke drawn so far, so a line grows rather than fades. */
function revealPoints(points: Point[], t: number): Point[] {
  if (points.length < 2) return points
  const target = (points.length - 1) * Math.min(1, t)
  const whole = Math.floor(target)
  const out = points.slice(0, whole + 1)

  if (whole < points.length - 1) {
    const f = target - whole
    const a = points[whole]
    const b = points[whole + 1]
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f })
  }
  return out
}

export { CONNECTORS, drawText }
