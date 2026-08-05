/**
 * Hand-drawn primitives for the canvas renderer.
 *
 * Everything here jitters deterministically from a seed rather than from
 * Math.random(), so a scene looks identical on replay and on scrub. Strokes are
 * drawn as several slightly-off passes, which is what makes a straight line
 * read as marker rather than vector.
 */

/** FNV-1a — small, fast, stable across runs. */
export function hash(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic value in [-amount, amount]. */
export function wobble(seed: string, salt: string, amount: number) {
  return ((hash(`${seed}:${salt}`) % 2001) / 1000 - 1) * amount
}

export interface Point {
  x: number
  y: number
}

/**
 * A line drawn the way a hand draws one: bowed slightly, and gone over twice
 * with the second pass not quite tracking the first.
 */
export function roughLine(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  seed: string,
  passes = 2
) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  const bow = Math.min(6, length * 0.012)

  for (let p = 0; p < passes; p++) {
    const j = (salt: string, amount: number) => wobble(seed, `${salt}${p}`, amount)
    ctx.beginPath()
    ctx.moveTo(a.x + j('ax', 1.4), a.y + j('ay', 1.4))
    ctx.quadraticCurveTo(
      (a.x + b.x) / 2 - (dy / length) * bow + j('cx', 2),
      (a.y + b.y) / 2 + (dx / length) * bow + j('cy', 2),
      b.x + j('bx', 1.4),
      b.y + j('by', 1.4)
    )
    ctx.stroke()
  }
}

/** Traces a rounded rectangle as four rough sides, overshooting the corners. */
export function roughRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string
) {
  const o = 3 // corner overshoot, the way a hand stops late
  roughLine(ctx, { x: x - o, y }, { x: x + w + o, y }, `${seed}t`)
  roughLine(ctx, { x: x + w, y: y - o }, { x: x + w, y: y + h + o }, `${seed}r`)
  roughLine(ctx, { x: x + w + o, y: y + h }, { x: x - o, y: y + h }, `${seed}b`)
  roughLine(ctx, { x, y: y + h + o }, { x, y: y - o }, `${seed}l`)
}

/** An ellipse drawn as a wobbling loop that overshoots where it started. */
export function roughEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: string,
  passes = 2
) {
  const STEPS = 34
  for (let p = 0; p < passes; p++) {
    ctx.beginPath()
    const start = wobble(seed, `s${p}`, Math.PI)
    for (let i = 0; i <= STEPS * 1.06; i++) {
      const t = start + (i / STEPS) * Math.PI * 2
      const breathe = 1 + wobble(seed, `w${p}${i % 7}`, 0.035)
      const px = cx + Math.cos(t) * rx * breathe
      const py = cy + Math.sin(t) * ry * breathe
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }
}

/** A polyline through points, each segment drawn rough. */
export function roughPath(ctx: CanvasRenderingContext2D, points: Point[], seed: string, passes = 2) {
  for (let i = 1; i < points.length; i++) {
    roughLine(ctx, points[i - 1], points[i], `${seed}${i}`, passes)
  }
}

/** A filled arrow head at `tip`, pointing away from `from`. */
export function arrowHead(ctx: CanvasRenderingContext2D, from: Point, tip: Point, size = 13) {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x)
  const spread = 0.42
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  ctx.lineTo(tip.x - Math.cos(angle - spread) * size, tip.y - Math.sin(angle - spread) * size)
  ctx.lineTo(tip.x - Math.cos(angle + spread) * size * 0.82, tip.y - Math.sin(angle + spread) * size * 0.82)
  ctx.closePath()
  ctx.fill()
}

export interface WrappedText {
  lines: string[]
  lineHeight: number
  width: number
  height: number
}

/**
 * Wraps text to a width and reports the space it will actually occupy.
 *
 * The renderer measures before it places, which is the whole reason this engine
 * exists: with tldraw the box was declared up front and the text grew past it,
 * so shapes that were laid out apart ended up overlapping on screen.
 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): WrappedText {
  const lineHeight = Number.parseFloat(ctx.font) * 1.28
  const lines: string[] = []
  let widest = 0

  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line)
        widest = Math.max(widest, ctx.measureText(line).width)
        line = word
      } else {
        line = candidate
      }
    }
    lines.push(line)
    widest = Math.max(widest, ctx.measureText(line).width)
  }

  return { lines, lineHeight, width: widest, height: lines.length * lineHeight }
}

/** Draws wrapped text centred in a box, and returns what it occupied. */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  align: CanvasTextAlign = 'center'
): WrappedText {
  const wrapped = wrapText(ctx, text, maxWidth)
  ctx.textAlign = align
  ctx.textBaseline = 'middle'

  for (const [i, line] of wrapped.lines.entries()) {
    ctx.fillText(line, x, y + i * wrapped.lineHeight + wrapped.lineHeight / 2)
  }
  return wrapped
}

/** Marker-style dashes: short strokes with gaps, not a CSS dash pattern. */
export function setDash(ctx: CanvasRenderingContext2D, dash: string, scale = 1) {
  if (dash === 'dashed') ctx.setLineDash([14 * scale, 9 * scale])
  else if (dash === 'dotted') ctx.setLineDash([2 * scale, 8 * scale])
  else ctx.setLineDash([])
}
