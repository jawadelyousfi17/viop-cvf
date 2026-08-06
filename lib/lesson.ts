import { parseMermaid, type NodeShape } from './mermaid'

/**
 * The "board language" the model writes lessons in.
 *
 * Every scene is laid out inside its own SCENE_W x SCENE_H box using local
 * coordinates, so the model always plans against the same fixed canvas. The
 * player offsets each scene horizontally onto one shared infinite canvas and
 * pans the camera between them, which is what makes the lesson feel like a
 * whiteboard that keeps growing rather than a slideshow.
 */

// 16:9, so the board fills a screen instead of leaving columns of nothing down
// either side. Height stays 800; the width is what grew.
export const SCENE_W = 1422
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
export const SCENE_GAP = 760

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
  // Charts are rendered server-side into one flat image — see lib/chart.ts.
  // Drawn from tldraw shapes they need the model to place every bar and label
  // itself, which is how a value ends up sitting on top of its own bar.
  'barchart',
  'linechart',
  'piechart',
  // Box-based gestures, drawn from x/y/w/h.
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
/**
 * One typeface, everywhere. A board written in four hands doesn't read as one
 * person's board — and the choice was never carrying meaning, only noise.
 */
export const BOARD_FONT = 'draw' as const

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
  /** Chart data. Only read by the chart kinds; empty for everything else. */
  data: { label: string; value: number }[]
  /**
   * Shapes sharing a group move as one rigid block through the layout pass.
   * Set internally when a Mermaid diagram is expanded — dagre has already
   * arranged those nodes relative to each other, and re-flowing them into rows
   * would throw that arrangement away. Never written by the model.
   */
  group?: string
}

export interface Scene {
  id: string
  heading: string
  narration: string
  shapes: BoardShape[]
  /**
   * A Mermaid flowchart for the graph-shaped part of the scene, expanded into
   * shapes during normalization. Empty when the scene has no such structure.
   */
  diagram: SceneDiagram
}

export interface SceneDiagram {
  /** Mermaid flowchart source. Empty string for none. */
  source: string
  /** When each node is drawn, keyed by its Mermaid id. */
  timing: { node: string; anchor: string; at: number }[]
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
        required: ['id', 'heading', 'narration', 'shapes', 'diagram'],
        properties: {
          id: { type: 'string' },
          heading: { type: 'string' },
          narration: { type: 'string' },
          diagram: {
            type: 'object',
            additionalProperties: false,
            required: ['source', 'timing'],
            properties: {
              source: { type: 'string' },
              timing: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['node', 'anchor', 'at'],
                  properties: {
                    node: { type: 'string' },
                    anchor: { type: 'string' },
                    at: { type: 'number' },
                  },
                },
              },
            },
          },
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
                'at',
                'anchor',
                'points',
                'data',
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
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['label', 'value'],
                    properties: { label: { type: 'string' }, value: { type: 'number' } },
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

    const data = (Array.isArray(shape.data) ? shape.data : [])
      .filter((d) => d && Number.isFinite(d.value))
      .slice(0, 12)
      .map((d) => ({ label: String(d.label ?? '').slice(0, 24), value: num(d.value, 0) }))

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
      data,
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

  // The arrow-label spacer runs on the model's own shapes only. dagre already
  // reserved room between ranks for the diagram's edge labels, and pushing
  // those nodes apart afterwards just dismantles the layout — which showed up
  // as a diagram block wider than the board it was fitted to.
  const spaced = spaceForArrowLabels(shapes)
  const withDiagram = [...spaced, ...expandDiagram(scene, sceneIndex)]

  return {
    id: scene.id || `scene-${sceneIndex + 1}`,
    heading: scene.heading || '',
    narration: (scene.narration ?? '').trim(),
    diagram: { source: '', timing: [] },
    shapes: centreContent(flowTopToBottom(withDiagram)).sort(
      (a, b) => a.at - b.at
    ),
  }
}


/** Mermaid node shapes map straight onto board kinds. */
const NODE_KINDS: Record<NodeShape, ShapeKind> = {
  box: 'box',
  oval: 'oval',
  ellipse: 'ellipse',
  diamond: 'diamond',
  hexagon: 'hexagon',
  arrowright: 'arrowright',
}

/**
 * Turns a scene's Mermaid diagram into board shapes.
 *
 * The nodes come out already arranged by dagre, tagged with a shared group so
 * the row layout moves them as one piece rather than dealing them back out
 * into rows. Arrows bind to the nodes by id, so tldraw re-routes them wherever
 * the block ends up.
 */
function expandDiagram(scene: Scene, sceneIndex: number): BoardShape[] {
  const graph = parseMermaid(scene.diagram?.source ?? '')
  if (!graph) return []

  const timing = new Map(
    (scene.diagram?.timing ?? [])
      .filter((entry) => entry && typeof entry.node === 'string')
      .map((entry) => [entry.node, entry])
  )

  const group = `d${sceneIndex}`
  const prefix = `${group}_`
  const shapes: BoardShape[] = []

  // Nodes first, in the order they appear down the graph, so the reveal reads
  // the way the diagram does when nothing says otherwise.
  const ordered = [...graph.nodes].sort((a, b) => a.y - b.y || a.x - b.x)

  for (const [i, node] of ordered.entries()) {
    const when = timing.get(node.id)
    shapes.push({
      id: prefix + node.id,
      kind: NODE_KINDS[node.shape] ?? 'box',
      text: node.label,
      x: node.x,
      y: node.y,
      w: node.w,
      h: node.h,
      from: null,
      to: null,
      color: 'black',
      fill: 'none',
      size: graph.scale < 0.85 ? 's' : 'm',
      dash: 'draw',
      at: clamp(num(when?.at, (i + 1) / (ordered.length + 2)), 0, 0.95),
      anchor: typeof when?.anchor === 'string' ? when.anchor.trim().slice(0, 60) : '',
      points: [],
      data: [],
      group,
    })
  }

  const ids = new Set(shapes.map((shape) => shape.id))
  for (const [i, edge] of graph.edges.entries()) {
    const from = prefix + edge.from
    const to = prefix + edge.to
    if (!ids.has(from) || !ids.has(to)) continue

    // An edge belongs to the moment its destination appears.
    const destination = shapes.find((shape) => shape.id === to)
    shapes.push({
      id: `${prefix}e${i}`,
      kind: 'arrow',
      text: edge.label,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      from,
      to,
      color: 'black',
      fill: 'none',
      size: 'm',
      dash: edge.dashed ? 'dashed' : 'draw',
      at: destination?.at ?? 0.5,
      anchor: destination?.anchor ?? '',
      points: [],
      data: [],
      group,
    })
  }

  return shapes
}

/** Approximate width of a character in tldraw's "draw" font, per size preset. */
const CHAR_WIDTH: Record<BoardShape['size'], number> = { s: 9, m: 12, l: 16, xl: 21 }
/** Line height for the same presets, for guessing how far text will grow. */
const LINE_HEIGHT: Record<BoardShape['size'], number> = { s: 22, m: 28, l: 38, xl: 52 }

/** Connectors and freehand strokes: they follow other shapes, so never packed. */
const FLOATING = new Set<ShapeKind>(['arrow', 'elbow', 'curve', 'line', 'highlight', 'laser'])

const MARGIN = 48
const GAP_X = 56
const GAP_Y = 56
const MIN_GAP_Y = 28
/** How far rows may be pushed apart to fill a tall board before it reads as sparse. */
const MAX_GAP_Y = 130

/**
 * The height a shape will actually occupy once its label has wrapped.
 *
 * tldraw measures text itself and grows the shape to fit, *after* we have
 * chosen where everything goes — which is how a three-line label ends up
 * sitting on the photograph beneath it. Guessing the grown height here and
 * packing against that is what stops it.
 */
function occupiedHeight(shape: BoardShape) {
  if (shape.kind === 'note') return 200
  if (!shape.text) return shape.h

  const padding = shape.kind === 'text' || shape.kind === 'label' ? 8 : 36
  const usable = Math.max(40, shape.w - padding)
  const lines = shape.text
    .split('\n')
    .reduce((total, line) => total + Math.max(1, Math.ceil(labelWidth(line, shape.size) / usable)), 0)

  const needed = lines * LINE_HEIGHT[shape.size] + padding
  return Math.max(shape.h, needed)
}

function occupiedWidth(shape: BoardShape) {
  return shape.kind === 'note' ? 200 : shape.w
}

/**
 * Lays a scene out as rows, stacked top to bottom.
 *
 * The model plans coordinates freely, and the result reads as a scatter: things
 * overlap, and there is no order to follow. This keeps the model's grouping —
 * whatever it put side by side stays side by side — but turns it into bands
 * that stack downward, with real gaps, so a scene reads the way a page does.
 *
 * Connectors are left alone: tldraw binds them to the shapes they join, so
 * they re-route themselves once those have moved.
 */
function flowTopToBottom(shapes: BoardShape[]): BoardShape[] {
  const loose = shapes.filter((shape) => !FLOATING.has(shape.kind) && !shape.group)

  // A diagram is already arranged by dagre; it enters the flow as one item.
  const groups = new Map<string, BoardShape[]>()
  for (const shape of shapes) {
    if (!shape.group) continue
    const list = groups.get(shape.group) ?? []
    list.push(shape)
    groups.set(shape.group, list)
  }

  const units: Unit[] = loose.map((shape) => ({ shapes: [shape], lead: shape }))
  for (const members of groups.values()) {
    const solid = members.filter((shape) => !FLOATING.has(shape.kind))
    if (!solid.length) continue
    units.push({ shapes: members, lead: solid[0], bounds: boundsOf(solid) })
  }
  if (!units.length) return shapes

  const available = SCENE_W - MARGIN * 2

  // Band by vertical overlap: anything that starts before the current band ends
  // was meant to sit beside what's already in it.
  const ordered = [...units].sort((a, b) => unitY(a) - unitY(b) || unitX(a) - unitX(b))
  const bands: Unit[][] = []
  let band: Unit[] = []
  let bandEnds = -Infinity

  for (const unit of ordered) {
    if (band.length && unitY(unit) >= bandEnds - 24) {
      bands.push(band)
      band = []
      bandEnds = -Infinity
    }
    band.push(unit)
    bandEnds = Math.max(bandEnds, unitY(unit) + unitH(unit) * 0.55)
  }
  if (band.length) bands.push(band)

  // A band too wide for the board wraps rather than being squeezed.
  const rows: Unit[][] = []
  for (const source of bands) {
    const byX = [...source].sort((a, b) => unitX(a) - unitX(b))
    let row: Unit[] = []
    let width = 0

    for (const unit of byX) {
      const next = unitW(unit)
      // A diagram is laid out to fill the width it is given, so it always gets
      // a row to itself — sharing one would push whatever it sits beside off
      // the board.
      const alone = Boolean(unit.bounds)
      if (row.length && (alone || width + GAP_X + next > available)) {
        rows.push(row)
        row = []
        width = 0
      }
      row.push(unit)
      width += (row.length > 1 ? GAP_X : 0) + next
      if (alone) {
        rows.push(row)
        row = []
        width = 0
      }
    }
    if (row.length) rows.push(row)
  }

  // Bands come from the y values the model wrote, and it tends to write more
  // of them than the board needs — six rows of two, where three rows of four
  // would fit and be half as tall. Height is what costs zoom, so merge any two
  // adjacent rows that would still fit across.
  for (let i = 0; i < rows.length - 1; ) {
    const a = rows[i]
    const b = rows[i + 1]
    const together = [...a, ...b]
    const width =
      together.reduce((sum, unit) => sum + unitW(unit), 0) + GAP_X * (together.length - 1)

    // A diagram keeps its own row, and four across is the legibility floor.
    const rigid = together.some((unit) => unit.bounds)
    if (!rigid && together.length <= 4 && width <= available) {
      rows.splice(i, 2, together)
    } else {
      i++
    }
  }

  const heights = rows.map((row) => Math.max(...row.map(unitH)))
  const content = heights.reduce((sum, height) => sum + height, 0)

  // Squeeze the gaps before shrinking anything: whitespace is the cheapest
  // thing to give up.
  const room = SCENE_H - MARGIN * 2
  let gap = GAP_Y
  if (content + gap * (rows.length - 1) > room && rows.length > 1) {
    gap = Math.max(MIN_GAP_Y, (room - content) / (rows.length - 1))
  }

  // Spread whatever is left over into the gaps rather than banking it as a
  // margin. A board with its content bunched in the middle reads as mostly
  // empty, which is the most common complaint about a generated scene.
  const slack = room - content - gap * (rows.length - 1)
  if (slack > 0 && rows.length > 1) {
    gap += Math.min(slack / (rows.length - 1), MAX_GAP_Y - gap)
  }

  const used = content + gap * (rows.length - 1)
  let y = MARGIN + Math.max(0, (room - used) / 2)

  for (const [index, row] of rows.entries()) {
    const height = heights[index]
    const natural = row.reduce((sum, unit) => sum + unitW(unit), 0) + GAP_X * (row.length - 1)

    // A row that nearly spans the board is stretched to span it properly;
    // a genuinely narrow row stays centred rather than being pulled apart.
    const stretch = row.length > 1 && natural > available * 0.55
    const spacing = stretch
      ? GAP_X + (available - natural) / (row.length - 1)
      : GAP_X
    const width = stretch
      ? available
      : natural

    let x = MARGIN + Math.max(0, (available - width) / 2)
    for (const unit of row) {
      // Every shape in a unit shifts by the same amount, which is what keeps a
      // diagram's internal arrangement intact.
      const dx = x - unitX(unit)
      const dy = y + (height - unitH(unit)) / 2 - unitY(unit)

      for (const shape of unit.shapes) {
        shape.x += dx
        shape.y += dy
        // Point-based shapes carry their geometry in `points`, so move those too.
        for (const point of shape.points) {
          point.x += dx
          point.y += dy
        }
      }
      x += unitW(unit) + spacing
    }
    y += height + gap
  }

  return shapes
}

/**
 * One thing the row layout places: a single shape, or a whole diagram that has
 * to move as a piece.
 */
interface Unit {
  shapes: BoardShape[]
  /** The shape whose position stands for the unit when it isn't a group. */
  lead: BoardShape
  bounds?: { x: number; y: number; w: number; h: number }
}

function boundsOf(shapes: BoardShape[]) {
  const x = Math.min(...shapes.map((shape) => shape.x))
  const y = Math.min(...shapes.map((shape) => shape.y))
  return {
    x,
    y,
    w: Math.max(...shapes.map((shape) => shape.x + occupiedWidth(shape))) - x,
    h: Math.max(...shapes.map((shape) => shape.y + occupiedHeight(shape))) - y,
  }
}

const unitX = (unit: Unit) => unit.bounds?.x ?? unit.lead.x
const unitY = (unit: Unit) => unit.bounds?.y ?? unit.lead.y
const unitW = (unit: Unit) => unit.bounds?.w ?? occupiedWidth(unit.lead)
const unitH = (unit: Unit) => unit.bounds?.h ?? occupiedHeight(unit.lead)

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
