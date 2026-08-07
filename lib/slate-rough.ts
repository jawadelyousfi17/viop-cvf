import { wobble } from './canvas-draw'

/**
 * Hand-drawn outlines, as SVG path data.
 *
 * The canvas engine already draws this way — `lib/canvas-draw.ts`, bowed
 * quadratics gone over twice, jittered from a seed rather than from
 * `Math.random()` so a scene looks identical on replay and on scrub. Slate's
 * renderer is DOM, not canvas, so it needs the same hand expressed as a `d`
 * attribute. It shares the seed function, which is what keeps the two engines
 * looking like one person drew them.
 *
 * Paths are generated in the element's own pixel space, after layout, rather
 * than in a normalised box that gets stretched. A wobble stretched 4× across a
 * wide shape and 1× down a short one stops reading as a hand and starts reading
 * as a bad SVG.
 */

/** Corner overshoot: a hand stops a little late, and that is most of the look. */
const OVERSHOOT = 3

/** How far a stroke may wander from true, in pixels. */
const JITTER = 1.3

/**
 * One side, bowed and jittered — the primitive everything else is made of.
 *
 * The bow scales with length and caps out, because a hand draws a short line
 * straight and lets a long one sag.
 */
function side(ax: number, ay: number, bx: number, by: number, seed: string, pass: number) {
  const dx = bx - ax
  const dy = by - ay
  const length = Math.hypot(dx, dy) || 1
  const bow = Math.min(6, length * 0.012)
  const j = (salt: string, amount: number) => wobble(seed, `${salt}${pass}`, amount)

  const cx = (ax + bx) / 2 - (dy / length) * bow + j('cx', 2)
  const cy = (ay + by) / 2 + (dx / length) * bow + j('cy', 2)

  return (
    `M${r(ax + j('ax', JITTER))} ${r(ay + j('ay', JITTER))}` +
    `Q${r(cx)} ${r(cy)} ${r(bx + j('bx', JITTER))} ${r(by + j('by', JITTER))}`
  )
}

/** Two decimals is under a tenth of a pixel and keeps the attribute short. */
const r = (n: number) => Math.round(n * 100) / 100

/**
 * A rectangle drawn as four rough sides that overshoot their corners.
 *
 * Two passes by default: the second not quite tracking the first is what makes
 * a straight edge read as marker rather than as a CSS border.
 */
export function roughRect(w: number, h: number, seed: string, passes = 2): string {
  const o = OVERSHOOT
  const out: string[] = []
  for (let p = 0; p < passes; p++) {
    out.push(
      side(-o, 0, w + o, 0, `${seed}t`, p),
      side(w, -o, w, h + o, `${seed}r`, p),
      side(w + o, h, -o, h, `${seed}b`, p),
      side(0, h + o, 0, -o, `${seed}l`, p)
    )
  }
  return out.join('')
}

/** An ellipse drawn as a wobbling loop that overshoots where it started. */
export function roughEllipse(w: number, h: number, seed: string, passes = 2): string {
  const cx = w / 2
  const cy = h / 2
  const rx = w / 2
  const ry = h / 2
  const STEPS = 34
  const out: string[] = []

  for (let p = 0; p < passes; p++) {
    const start = wobble(seed, `s${p}`, Math.PI)
    const points: string[] = []
    for (let i = 0; i <= STEPS * 1.06; i++) {
      const t = start + (i / STEPS) * Math.PI * 2
      const breathe = 1 + wobble(seed, `w${p}${i % 7}`, 0.035)
      points.push(`${r(cx + Math.cos(t) * rx * breathe)} ${r(cy + Math.sin(t) * ry * breathe)}`)
    }
    out.push(`M${points[0]}L${points.slice(1).join('L')}`)
  }
  return out.join('')
}

/**
 * A diamond, for a decision. Four rough sides between the edge midpoints, and
 * no overshoot — the corners are the shape here, not an accident of stopping.
 */
export function roughDiamond(w: number, h: number, seed: string, passes = 2): string {
  const out: string[] = []
  for (let p = 0; p < passes; p++) {
    out.push(
      side(w / 2, 0, w, h / 2, `${seed}a`, p),
      side(w, h / 2, w / 2, h, `${seed}b`, p),
      side(w / 2, h, 0, h / 2, `${seed}c`, p),
      side(0, h / 2, w / 2, 0, `${seed}d`, p)
    )
  }
  return out.join('')
}

/** A single rough stroke, for rules and underlines. */
export function roughStroke(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  seed: string,
  passes = 2
): string {
  const out: string[] = []
  for (let p = 0; p < passes; p++) out.push(side(ax, ay, bx, by, seed, p))
  return out.join('')
}

/** Which generator a shape wants, by the class the renderer gave it. */
export type RoughShape = 'rect' | 'ellipse' | 'diamond' | 'underline'

export function roughPath(shape: RoughShape, w: number, h: number, seed: string): string {
  if (shape === 'ellipse') return roughEllipse(w, h, seed)
  if (shape === 'diamond') return roughDiamond(w, h, seed)
  if (shape === 'underline') return roughStroke(0, h, w, h, seed)
  return roughRect(w, h, seed)
}
