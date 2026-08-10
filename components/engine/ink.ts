/**
 * Hand-drawn geometry.
 *
 * Everything the board draws is a path through slightly wrong points. A
 * rectangle whose corners are exactly where they should be reads as a UI
 * element; the same rectangle with each corner a few pixels off, drawn with a
 * line that bows on its way across, reads as something a person drew — and that
 * is the whole difference between a diagram and a whiteboard.
 *
 * The wrongness is deterministic. Every offset comes from a hash of the shape's
 * own id, so a shape wobbles the same way on every render and every reload: the
 * board is hand-drawn but never restless, and React can re-render it as often
 * as it likes without the ink crawling.
 */

/** FNV-1a, which is small, fast and mixes short strings like ids well. */
function hash(text: string) {
  let value = 2166136261
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

/** A stable number in [-1, 1] for a given shape and purpose. */
export function jitter(seed: string, salt: string) {
  const value = hash(`${seed}/${salt}`)
  // Two rounds of mixing, or neighbouring salts ("p0x", "p1x") come out
  // suspiciously similar and the wobble looks like a wave rather than a hand.
  const mixed = Math.imul(value ^ (value >>> 15), 2246822507) >>> 0
  return (mixed / 0xffffffff) * 2 - 1
}

export interface Point {
  x: number
  y: number
}

/** Nudges a point by up to `amount`, deterministically. */
function drift(point: Point, seed: string, salt: string, amount: number): Point {
  return {
    x: point.x + jitter(seed, `${salt}x`) * amount,
    y: point.y + jitter(seed, `${salt}y`) * amount,
  }
}

/**
 * A line that bows.
 *
 * A hand does not travel in a straight line between two points — it arcs
 * slightly, and the arc is what a ruler-straight SVG line is missing. One
 * quadratic through an off-centre control point is enough; anything more
 * elaborate reads as a wiggle rather than a stroke.
 */
export function inkLine(a: Point, b: Point, seed: string, salt = 'l', bow = 1) {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  // Bow perpendicular to the line, scaled to its length so a short stroke
  // doesn't buckle and a long one doesn't look ruled.
  const amount = Math.min(6, length * 0.02) * bow * jitter(seed, `${salt}bow`)
  const control = {
    x: mid.x + (-dy / length) * amount,
    y: mid.y + (dx / length) * amount,
  }
  return `M ${round(a.x)} ${round(a.y)} Q ${round(control.x)} ${round(control.y)} ${round(b.x)} ${round(b.y)}`
}

/**
 * A closed shape drawn as one continuous stroke, corners rounded the way a
 * marker rounds them, with the end overshooting the start a little because a
 * hand does not stop exactly where it started.
 */
export function inkPolygon(
  points: Point[],
  seed: string,
  salt = 'p',
  wobbleAmount = 2.5,
  /**
   * Whether the last point joins back to the first.
   *
   * False for a stroke someone drew — a curve, a rule, a highlighter sweep.
   * Closing one of those turns a gesture into a shape, which is a different
   * mark entirely and reads as an accident.
   */
  close = true
) {
  if (points.length < 2) return ''

  const drawn = points.map((point, i) => drift(point, seed, `${salt}${i}`, wobbleAmount))

  let path = `M ${round(drawn[0].x)} ${round(drawn[0].y)}`
  for (let i = 1; i < drawn.length; i++) {
    path += ` ${segment(drawn[i - 1], drawn[i], seed, `${salt}s${i}`)}`
  }
  if (!close) return path

  // Carry on past the start so the stroke crosses itself at the corner.
  const overshoot = lerp(drawn[0], drawn[1], 0.12)
  path += ` ${segment(drawn[drawn.length - 1], drawn[0], seed, `${salt}sc`)}`
  path += ` ${segment(drawn[0], overshoot, seed, `${salt}so`)}`
  return path
}

function segment(a: Point, b: Point, seed: string, salt: string) {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  const amount = Math.min(5, length * 0.018) * jitter(seed, salt)
  const control = {
    x: mid.x + (-dy / length) * amount,
    y: mid.y + (dx / length) * amount,
  }
  return `Q ${round(control.x)} ${round(control.y)} ${round(b.x)} ${round(b.y)}`
}

/** A rectangle as four drifting corners. */
export function inkRect(x: number, y: number, w: number, h: number, seed: string, salt = 'r') {
  return inkPolygon(
    [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    seed,
    salt
  )
}

/**
 * An ellipse, sampled at a dozen points with a wandering radius.
 *
 * Sampled rather than drawn with SVG's own arc command for the same reason the
 * rectangle is: a perfect ellipse is the one shape a person cannot draw, and it
 * is instantly recognisable as machine-made.
 */
export function inkEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: string,
  salt = 'e'
) {
  const steps = 14
  const points: Point[] = []
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2
    const wobble = 1 + jitter(seed, `${salt}${i}`) * 0.022
    points.push({ x: cx + Math.cos(angle) * rx * wobble, y: cy + Math.sin(angle) * ry * wobble })
  }

  // Through-the-midpoints smoothing: every sample becomes a control point, so
  // the curve stays round instead of turning into a polygon with soft corners.
  let path = `M ${round((points[0].x + points[steps - 1].x) / 2)} ${round((points[0].y + points[steps - 1].y) / 2)}`
  for (let i = 0; i < steps; i++) {
    const current = points[i]
    const next = points[(i + 1) % steps]
    path += ` Q ${round(current.x)} ${round(current.y)} ${round((current.x + next.x) / 2)} ${round((current.y + next.y) / 2)}`
  }
  return path
}

/** The two short strokes at the business end of an arrow. */
export function inkArrowhead(tip: Point, from: Point, seed: string, size = 16) {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x)
  const spread = 0.42 + jitter(seed, 'head') * 0.06
  const wing = (turn: number): Point => ({
    x: tip.x - Math.cos(angle + turn) * size,
    y: tip.y - Math.sin(angle + turn) * size,
  })
  return `${inkLine(tip, wing(spread), seed, 'h1', 0.4)} ${inkLine(tip, wing(-spread), seed, 'h2', 0.4)}`
}

/** Where a line from `from` leaves the box around `to`, plus a little air. */
export function edgePoint(box: { x: number; y: number; w: number; h: number }, towards: Point, gap = 8) {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const dx = towards.x - cx
  const dy = towards.y - cy
  if (!dx && !dy) return { x: cx, y: cy }

  // Scale the direction until it touches the nearer pair of edges.
  const scale = Math.min(
    Math.abs(dx) > 0.001 ? (box.w / 2 + gap) / Math.abs(dx) : Infinity,
    Math.abs(dy) > 0.001 ? (box.h / 2 + gap) / Math.abs(dy) : Infinity
  )
  return { x: cx + dx * scale, y: cy + dy * scale }
}

/** A small, stable tilt in degrees — nothing on a real board is quite square. */
export function tilt(seed: string, amount = 0.5) {
  return jitter(seed, 'tilt') * amount
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function round(value: number) {
  return Math.round(value * 10) / 10
}
