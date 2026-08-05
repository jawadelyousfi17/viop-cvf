/**
 * The "board language" the model writes lessons in.
 *
 * Every scene is laid out inside its own SCENE_W x SCENE_H box using local
 * coordinates, so the model always plans against the same fixed canvas. The
 * player offsets each scene horizontally onto one shared infinite canvas and
 * pans the camera between them, which is what makes the lesson feel like a
 * whiteboard that keeps growing rather than a slideshow.
 */

export const SCENE_W = 1200
export const SCENE_H = 800
/**
 * Vertical space between scenes on the shared canvas.
 *
 * Scenes stack downward, so the lesson reads as one long page you scroll
 * through. The camera frames a scene's box plus padding for the player's
 * chrome, and height is what binds at typical viewport ratios, so the visible
 * band extends a few hundred units past the scene itself. This gap keeps the
 * next scene out of shot while leaving room for the connector drawn between
 * them.
 */
export const SCENE_GAP = 620

/**
 * How far past SCENE_W the spacing pass may push content when it needs to open
 * up room for an arrow label. Kept below SCENE_GAP so a widened scene can never
 * run into the next one on the shared canvas.
 */
export const SCENE_SLACK = 200

export function sceneBounds(index: number) {
  return {
    x: 0,
    y: index * (SCENE_H + SCENE_GAP),
    w: SCENE_W,
    h: SCENE_H,
  }
}

export const SHAPE_KINDS = [
  'text',
  /** Bare marker lettering with a dashed rule under it — no box. */
  'label',
  'box',
  'ellipse',
  'diamond',
  'triangle',
  'hexagon',
  'star',
  'cloud',
  'oval',
  'xbox',
  'check',
  'heart',
  'pentagon',
  'octagon',
  'trapezoid',
  'rhombus',
  'arrowright',
  'arrowleft',
  'arrowup',
  'arrowdown',
  'note',
  'arrow',
  /** Right-angle routed connector, for grids and orthogonal diagrams. */
  'elbow',
  'image',
  'icon',
  // Composites: many shapes drawn as one, built from `text`.
  'table',
  'array',
  'stack',
  'bars',
  // Box-based gestures, drawn from x/y/w/h.
  'axes',
  'ring',
  // Point-based. Geometry comes from `points`, not x/y/w/h.
  'curve',
  'line',
  'highlight',
  'laser',
] as const

/** Kinds whose shape is defined by `points` rather than a bounding box. */
export const POINT_KINDS = new Set<ShapeKind>(['curve', 'line', 'highlight', 'laser'])

const MAX_POINTS: Record<string, number> = { curve: 48, line: 12, highlight: 24, laser: 24 }

/** Floor for a photograph on the board. */
const MIN_IMAGE_W = 500
const MIN_IMAGE_H = 340

export const COLORS = [
  'black',
  'grey',
  'blue',
  'light-blue',
  'green',
  'light-green',
  'red',
  'light-red',
  'orange',
  'yellow',
  'violet',
  'light-violet',
] as const

// tldraw's full fill set. 'fill' is a flat wash, 'lined-fill' a hatched one —
// both were unused, and they are the cheapest way to make a board read as
// deliberately styled rather than uniformly outlined.
export const FILLS = ['none', 'semi', 'solid', 'pattern', 'fill', 'lined-fill'] as const
export const SIZES = ['s', 'm', 'l', 'xl'] as const
export const DASHES = ['draw', 'solid', 'dashed', 'dotted'] as const
/** tldraw's four typefaces. 'mono' is what makes code and values read as code. */
export const FONTS = ['draw', 'sans', 'serif', 'mono'] as const

export type ShapeKind = (typeof SHAPE_KINDS)[number]
export type BoardColor = (typeof COLORS)[number]

export interface BoardShape {
  /** Unique within the scene. Arrows reference these ids. */
  id: string
  kind: ShapeKind
  /** Label text. Empty string when the shape has no label. */
  text: string
  /** Top-left corner, in scene-local coordinates. */
  x: number
  y: number
  w: number
  h: number
  /** Arrow source/target shape id, or null for a free-floating arrow. */
  from: string | null
  to: string | null
  color: BoardColor
  fill: (typeof FILLS)[number]
  size: (typeof SIZES)[number]
  dash: (typeof DASHES)[number]
  /** Typeface. 'mono' for code and values, 'serif' for quotations. */
  font: (typeof FONTS)[number]
  /** When this shape appears, as a fraction (0-1) of the scene's narration. */
  at: number
  /**
   * A short phrase copied from this scene's narration. When the voice provider
   * returns timing data, the shape is drawn exactly as that phrase is spoken;
   * `at` is the fallback when it can't be matched or there's no alignment.
   */
  anchor: string
  /**
   * Absolute scene coordinates defining a curve, line or highlight stroke.
   * Empty for every other kind, which uses x/y/w/h instead.
   */
  points: { x: number; y: number }[]
}

export interface Scene {
  id: string
  heading: string
  narration: string
  shapes: BoardShape[]
}

export interface Lesson {
  title: string
  summary: string
  scenes: Scene[]
}

/**
 * Strict JSON schema for OpenAI structured outputs. Strict mode requires every
 * property to be listed in `required` and forbids extra keys, so "optional"
 * fields are expressed as nullable instead.
 */
export const SCENE_JSON_SCHEMA = {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'heading', 'narration', 'shapes'],
        properties: {
          id: { type: 'string' },
          heading: { type: 'string' },
          narration: { type: 'string' },
          shapes: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'id',
                'kind',
                'text',
                'x',
                'y',
                'w',
                'h',
                'from',
                'to',
                'color',
                'fill',
                'size',
                'dash',
                'font',
                'at',
                'anchor',
                'points',
              ],
              properties: {
                id: { type: 'string' },
                kind: { type: 'string', enum: [...SHAPE_KINDS] },
                text: { type: 'string' },
                x: { type: 'number' },
                y: { type: 'number' },
                w: { type: 'number' },
                h: { type: 'number' },
                from: { type: ['string', 'null'] },
                to: { type: ['string', 'null'] },
                color: { type: 'string', enum: [...COLORS] },
                fill: { type: 'string', enum: [...FILLS] },
                size: { type: 'string', enum: [...SIZES] },
                dash: { type: 'string', enum: [...DASHES] },
                font: { type: 'string', enum: [...FONTS] },
                at: { type: 'number' },
                anchor: { type: 'string' },
                points: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['x', 'y'],
                    properties: { x: { type: 'number' }, y: { type: 'number' } },
                  },
                },
              },
            },
          },
        },
} as const

export const LESSON_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'scenes'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    scenes: { type: 'array', items: SCENE_JSON_SCHEMA },
  },
} as const

/** One scene on its own — used for answering a question mid-lesson. */
export const ANSWER_JSON_SCHEMA = SCENE_JSON_SCHEMA

/** Rough words-per-second for estimating scene length when TTS is unavailable. */
const WORDS_PER_SECOND = 2.6

export function estimateNarrationSeconds(narration: string) {
  const words = narration.trim().split(/\s+/).filter(Boolean).length
  return Math.max(3, words / WORDS_PER_SECOND + 0.8)
}

/**
 * Repairs one scene into something the board can render: clamps geometry to the
 * scene box, drops arrows pointing at ids that don't exist, and makes reveal
 * times monotonic so shapes appear in reading order.
 *
 * Per-scene rather than per-lesson because scenes stream in one at a time and
 * each is normalized the moment it lands.
 */
export function normalizeScene(scene: Scene, sceneIndex: number): Scene {
  const seen = new Set<string>()
  const shapes: BoardShape[] = []

  for (const [i, shape] of (scene.shapes ?? []).entries()) {
    if (!shape) continue

    let id = shape.id || `s${i}`
    while (seen.has(id)) id = `${id}_`
    seen.add(id)

    const kind = SHAPE_KINDS.includes(shape.kind) ? shape.kind : 'text'
    const isArrow = kind === 'arrow'

    const points = (Array.isArray(shape.points) ? shape.points : [])
      .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
      .slice(0, MAX_POINTS[kind] ?? 0)
      .map((p) => ({
        x: clamp(p.x, 0, SCENE_W),
        y: clamp(p.y, 0, SCENE_H),
      }))

    // A point-based kind with too few points can't be drawn; fall back to text
    // so the label at least survives.
    const usable = POINT_KINDS.has(kind) && points.length >= 2

    let w = clamp(num(shape.w, isArrow ? 160 : 200), isArrow ? -SCENE_W : 24, SCENE_W)
    let h = clamp(num(shape.h, isArrow ? 0 : 100), isArrow ? -SCENE_H : 24, SCENE_H)

    // A photograph the size of a label is not worth the round trip. The model
    // undersizes them consistently, so enforce a floor rather than ask twice.
    if (kind === 'image') {
      w = clamp(Math.max(w, MIN_IMAGE_W), MIN_IMAGE_W, SCENE_W - 80)
      h = clamp(Math.max(h, MIN_IMAGE_H), MIN_IMAGE_H, SCENE_H - 80)
    }
    let x = clamp(num(shape.x, 40), 0, SCENE_W - 24)
    let y = clamp(num(shape.y, 40), 0, SCENE_H - 24)

    // Derive a bounding box from the points so spacing and camera framing can
    // treat every kind the same way.
    if (usable) {
      const xs = points.map((p) => p.x)
      const ys = points.map((p) => p.y)
      x = Math.min(...xs)
      y = Math.min(...ys)
      w = Math.max(1, Math.max(...xs) - x)
      h = Math.max(1, Math.max(...ys) - y)
    }

    shapes.push({
      id,
      kind: POINT_KINDS.has(kind) && !usable ? 'text' : kind,
      points: usable ? points : [],
      text: typeof shape.text === 'string' ? shape.text : '',
      anchor: typeof shape.anchor === 'string' ? shape.anchor.trim().slice(0, 60) : '',
      x,
      y,
      w,
      h,
      from: shape.from || null,
      to: shape.to || null,
      color: COLORS.includes(shape.color) ? shape.color : 'black',
      fill: FILLS.includes(shape.fill) ? shape.fill : 'none',
      size: SIZES.includes(shape.size) ? shape.size : 'm',
      dash: DASHES.includes(shape.dash) ? shape.dash : 'draw',
      font: FONTS.includes(shape.font) ? shape.font : 'draw',
      at: clamp(num(shape.at, i / Math.max(1, (scene.shapes ?? []).length)), 0, 0.95),
    })
  }

  const ids = new Set(shapes.map((s) => s.id))
  for (const shape of shapes) {
    if (shape.from && !ids.has(shape.from)) shape.from = null
    if (shape.to && !ids.has(shape.to)) shape.to = null
  }

  // An arrow can never be drawn before the shapes it connects.
  const byId = new Map(shapes.map((s) => [s.id, s]))
  for (const shape of shapes) {
    if (shape.kind !== 'arrow') continue
    for (const ref of [shape.from, shape.to]) {
      const target = ref ? byId.get(ref) : undefined
      if (target) shape.at = Math.max(shape.at, target.at)
    }
  }

  return {
    id: scene.id || `scene-${sceneIndex + 1}`,
    heading: scene.heading || '',
    narration: (scene.narration ?? '').trim(),
    shapes: centreContent(spaceForArrowLabels(shapes)).sort((a, b) => a.at - b.at),
  }
}

/** Approximate width of a character in tldraw's "draw" font, per size preset. */
const CHAR_WIDTH: Record<BoardShape['size'], number> = { s: 9, m: 12, l: 16, xl: 21 }

function labelWidth(text: string, size: BoardShape['size']) {
  return text.length * CHAR_WIDTH[size]
}

/**
 * Centres a scene's content inside the board.
 *
 * The model plans against a fixed box but rarely fills it evenly, so scenes
 * drift to one corner and read as mostly empty. Measuring what was actually
 * drawn and shifting it to the middle costs nothing and fixes every scene.
 */
function centreContent(shapes: BoardShape[]): BoardShape[] {
  if (!shapes.length) return shapes

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const shape of shapes) {
    const w = shape.kind === 'note' ? 200 : shape.w
    const h = shape.kind === 'note' ? 200 : shape.h
    minX = Math.min(minX, shape.x, shape.x + w)
    minY = Math.min(minY, shape.y, shape.y + h)
    maxX = Math.max(maxX, shape.x, shape.x + w)
    maxY = Math.max(maxY, shape.y, shape.y + h)
    for (const point of shape.points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
  }

  if (!Number.isFinite(minX)) return shapes

  const dx = (SCENE_W - (maxX - minX)) / 2 - minX
  const dy = (SCENE_H - (maxY - minY)) / 2 - minY

  for (const shape of shapes) {
    shape.x += dx
    shape.y += dy
    for (const point of shape.points) {
      point.x += dx
      point.y += dy
    }
  }

  return shapes
}

/**
 * Opens up horizontal room for arrow labels.
 *
 * tldraw fits an arrow's label inside the arrow's own span, so a wordy label on
 * a short arrow wraps one or two characters per line and collides with the
 * shapes at each end. The prompt asks for generous gaps, but the model is not
 * reliable about it, so this pass measures each labelled arrow and pushes the
 * downstream shapes right until the label fits.
 */
function spaceForArrowLabels(shapes: BoardShape[]): BoardShape[] {
  const arrows = shapes.filter((s) => s.kind === 'arrow' && s.text.trim() && s.from && s.to)
  if (!arrows.length) return shapes

  const byId = new Map(shapes.map((s) => [s.id, s]))

  // Chains can need several nudges; each pass fixes the tightest link.
  for (let pass = 0; pass < 3; pass++) {
    let moved = false

    for (const arrow of arrows) {
      const a = byId.get(arrow.from!)
      const b = byId.get(arrow.to!)
      if (!a || !b) continue

      // Only horizontal links: a vertical arrow's label has the whole row gap
      // to sit in and doesn't suffer the same squeeze.
      const dx = b.x + b.w / 2 - (a.x + a.w / 2)
      const dy = b.y + b.h / 2 - (a.y + a.h / 2)
      if (Math.abs(dx) < Math.abs(dy)) continue

      const [left, right] = dx >= 0 ? [a, b] : [b, a]
      const gap = right.x - (left.x + left.w)
      const needed = labelWidth(arrow.text.trim(), arrow.size) + 48
      const delta = needed - gap
      if (delta <= 1) continue

      // Shift the right-hand shape and everything downstream of it, so the rest
      // of the chain keeps its spacing.
      const threshold = right.x
      const widest = Math.max(...shapes.map((s) => s.x + s.w))
      const room = SCENE_W + SCENE_SLACK - widest
      const shift = Math.min(delta, Math.max(0, room))
      if (shift < 1) continue

      for (const shape of shapes) {
        if (shape.x >= threshold && shape.id !== left.id) shape.x += shift
      }
      moved = true
    }

    if (!moved) break
  }

  return shapes
}

export function isRenderableScene(scene: Scene | null | undefined): scene is Scene {
  return !!scene && typeof scene.narration === 'string' && scene.narration.trim().length > 0
}

export function normalizeLesson(raw: Lesson): Lesson {
  const scenes = (raw.scenes ?? []).filter(isRenderableScene).map(normalizeScene)

  return {
    title: raw.title || 'Lesson',
    summary: raw.summary || '',
    scenes,
  }
}

function num(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
