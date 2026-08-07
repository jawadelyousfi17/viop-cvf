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

/**
 * 16:9, so the board fills a screen instead of leaving columns of nothing down
 * either side.
 *
 * Big numbers on purpose. Shape sizes are absolute — a box is 300 units wide
 * whatever the board is — so the size of this box decides how many of them fit
 * across a row, and therefore how many rows a scene needs. At 1422 a scene of
 * twenty shapes needed six rows and came out half again as tall as it was wide,
 * which meant the camera fitted it by height and left a third of the screen
 * empty down each side. The same content across 1920 is four rows and fills it.
 */
export const SCENE_W = 1920
export const SCENE_H = 1080
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
  /** A line-art symbol, fetched by name from The Noun Project. */
  'symbol',
  'icon',
  /** Source, set in a monospace face, with one line boxed. */
  'code',
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
] as const

/** Kinds whose shape is defined by `points` rather than a bounding box. */
export const POINT_KINDS = new Set<ShapeKind>(['curve', 'line', 'highlight'])

const MAX_POINTS: Record<string, number> = { curve: 48, line: 12, highlight: 24 }

/**
 * Floor for a photograph on the board. Shallower than it is wide: height is the
 * scarce dimension, and a picture that claims two rows of it pushes the
 * explanation off the bottom of the scene.
 */
const MIN_IMAGE_W = 440
const MIN_IMAGE_H = 250

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
   * The id of the shape this one sits inside, or null for a shape on the board
   * itself.
   *
   * Saying what contains what is a judgement — a scheduler belongs inside the
   * kernel, not beside it — and saying how big that makes the kernel is
   * arithmetic. This carries the judgement; the sizes are worked out from it.
   */
  parent: string | null
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
  /**
   * Whether the layout passes get to move things.
   *
   * "auto" is the default and what a model-written scene wants: it plans
   * coordinates badly, so the row layout re-flows them into bands and centres
   * the result. "fixed" leaves every coordinate exactly as given, and is what
   * a scene drawn by hand in the authoring tool wants — there, the positions
   * *are* the design, and re-flowing them would throw away the drawing.
   *
   * Absent from the model's JSON schema on purpose. It is not a decision the
   * model gets to make.
   */
  layout?: 'auto' | 'fixed'
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
                'parent',
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
                parent: { type: ['string', 'null'] },
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

    // A code block is sized by what is in it: the model has no idea how wide a
    // monospace line runs, and a guess that is too small crushes the text.
    if (kind === 'code') {
      const lines = String(shape.text ?? '').split('\n')
      const longest = Math.max(...lines.map((line) => line.length), 10)
      w = clamp(Math.max(w, longest * 15 + 80), 360, SCENE_W - 120)
      h = clamp(Math.max(h, lines.length * 46 + 56), 120, SCENE_H - 120)
    }

    // A photograph the size of a label is not worth the round trip. The model
    // undersizes them consistently, so enforce a floor rather than ask twice.
    if (kind === 'image') {
      w = clamp(Math.max(w, MIN_IMAGE_W), MIN_IMAGE_W, SCENE_W - 80)
      h = clamp(Math.max(h, MIN_IMAGE_H), MIN_IMAGE_H, SCENE_H - 80)
    }
    // A symbol is a glyph, not a photograph: it reads at icon size and looks
    // absurd blown up to fill a row.
    if (kind === 'symbol') {
      w = clamp(w, 90, 320)
      h = clamp(h, 90, 320)
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
      parent: shape.parent || null,
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
    if (shape.parent && (!ids.has(shape.parent) || shape.parent === shape.id)) shape.parent = null
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

  // A hand-drawn scene is already laid out — by a person, on the board, at the
  // size they wanted. Every pass below exists to rescue coordinates a model
  // guessed, and running them here would only undo the drawing.
  if (scene.layout === 'fixed') {
    return {
      id: scene.id || `scene-${sceneIndex + 1}`,
      heading: scene.heading || '',
      narration: (scene.narration ?? '').trim(),
      diagram: { source: '', timing: [] },
      layout: 'fixed',
      shapes: [...shapes, ...expandDiagram(scene, sceneIndex)].sort((a, b) => a.at - b.at),
    }
  }

  // The arrow-label spacer runs on the model's own shapes only. dagre already
  // reserved room between ranks for the diagram's edge labels, and pushing
  // those nodes apart afterwards just dismantles the layout — which showed up
  // as a diagram block wider than the board it was fitted to.
  const spaced = fitFrames(spaceForArrowLabels(groupFrames(nestChildren(shapes))))
  const withDiagram = [...spaced, ...expandDiagram(scene, sceneIndex)]

  // Where the model put things, kept before the layout rewrites it — the only
  // record of which shape a ring was drawn around.
  const placed = new Map(
    withDiagram.map((shape) => [
      shape.id,
      { x: shape.x, y: shape.y, w: occupiedWidth(shape), h: occupiedHeight(shape) },
    ])
  )

  return {
    id: scene.id || `scene-${sceneIndex + 1}`,
    heading: scene.heading || '',
    narration: (scene.narration ?? '').trim(),
    diagram: { source: '', timing: [] },
    // Frames are fitted twice: once so the spacing pass leaves them a sane box,
    // and again once the arrow labels have been lifted onto the board, so a
    // region is drawn around its own captions rather than through them.
    shapes: centreContent(
      attachRings(
        fitFrames(liftArrowLabels(carryGestures(flowTopToBottom(withDiagram), placed))),
        placed
      )
    ).sort((a, b) => a.at - b.at),
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
  // Sized against the board rather than a constant of its own, so the two can
  // never drift apart. A diagram may take the full width but only about two
  // thirds of the height — the rest of the scene has to go somewhere.
  const graph = parseMermaid(scene.diagram?.source ?? '', {
    maxW: SCENE_W - MARGIN * 2,
    maxH: Math.round(SCENE_H * 0.68),
  })
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
      parent: null,
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
      size: graph.scale < 0.85 ? 's' : 'm',
      dash: edge.dashed ? 'dashed' : 'draw',
      at: destination?.at ?? 0.5,
      anchor: destination?.anchor ?? '',
      points: [],
      data: [],
      parent: null,
      group,
    })
  }

  return shapes
}

/** Approximate width of a character in tldraw's "draw" font, per size preset. */
const CHAR_WIDTH: Record<BoardShape['size'], number> = { s: 9, m: 12, l: 16, xl: 21 }
/** Line height for the same presets, for guessing how far text will grow. */
const LINE_HEIGHT: Record<BoardShape['size'], number> = { s: 22, m: 28, l: 38, xl: 52 }

/**
 * Connectors, freehand strokes and overlays: they follow other shapes, so they
 * are never packed into a row. A ring is here because it means "around that" —
 * dealt into a band of its own it becomes an empty circle beside the thing it
 * was drawn to circle. It is placed by attachRings once the layout has settled.
 */
const FLOATING = new Set<ShapeKind>([
  'arrow',
  'elbow',
  'curve',
  'line',
  'highlight',
  'ring',
])

const MARGIN = 48
const GAP_X = 56
const GAP_Y = 56
const MIN_GAP_Y = 28
/** How far rows may be pushed apart to fill a tall board before it reads as sparse. */
const MAX_GAP_Y = 130
/**
 * Room between two shapes an arrow runs between, across and down.
 *
 * A connector needs a run. Packed at the ordinary gap, two boxes joined by an
 * arrow read as two boxes touching, and whatever the arrow was labelled with
 * has nowhere to sit.
 */
const LINK_GAP_X = 128
const LINK_GAP_Y = 112

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
 * It also reads the arrows. A connector is the one thing in a scene that states
 * a relationship outright, and packing by coordinates alone threw that away:
 * two boxes joined by a short arrow could land in different rows with unrelated
 * shapes between them, leaving a diagonal across the board. So the ties are
 * worked out first, and then they decide which units share a row, in what
 * order, and how much room is left between them.
 *
 * Connectors themselves are never placed: tldraw binds them to the shapes they
 * join, so they re-route once those have moved.
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
  const ix = new Map<Unit, number>(units.map((unit, index) => [unit, index]))
  const at = (unit: Unit) => ix.get(unit)!
  const ties = tiesBetween(shapes, units)

  /** Do these two rows have an arrow running between them? */
  const bridges = (a: Unit[], b: Unit[], within: Set<string>) =>
    a.some((one) => b.some((other) => within.has(tieKey(at(one), at(other)))))

  const gapAfter = (a: Unit, b: Unit) =>
    ties.joined.has(tieKey(at(a), at(b))) ? LINK_GAP_X : GAP_X

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

  // An arrow drawn across the board means the two ends were meant to sit beside
  // each other. The model rarely writes them at exactly the same y, so banding
  // on y alone splits them into separate rows — and a step that was meant to
  // read left-to-right becomes a diagonal. Pull those bands back together while
  // the board is still wide enough to hold them.
  for (let i = 0; i < bands.length - 1; ) {
    const together = [...bands[i], ...bands[i + 1]]
    const width =
      together.reduce((sum, unit) => sum + unitW(unit), 0) + GAP_X * (together.length - 1)

    if (bridges(bands[i], bands[i + 1], ties.across) && width <= available) {
      bands.splice(i, 2, together)
    } else {
      i++
    }
  }

  // A band too wide for the board wraps rather than being squeezed.
  const rows: Unit[][] = []
  for (const source of bands) {
    const byX = [...source].sort((a, b) => unitX(a) - unitX(b))
    let row: Unit[] = []
    let width = 0

    for (const unit of byX) {
      const next = unitW(unit)
      // Measured with the gap this pair will actually get, so a row of linked
      // boxes wraps on the width it needs rather than overflowing the board.
      const gap = row.length ? gapAfter(row[row.length - 1], unit) : 0
      // A wide diagram gets a row to itself; a tall narrow one does not. A
      // vertical chain is ~280 wide and ~600 tall, and giving that its own row
      // wastes three quarters of the board's width and makes the scene tall
      // enough that height, not width, decides the zoom.
      const alone = Boolean(unit.bounds) && next > available * 0.55
      if (row.length && (alone || width + gap + next > available)) {
        rows.push(row)
        row = []
        width = 0
      }
      row.push(unit)
      width += (row.length > 1 ? gap : 0) + next
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
    // An arrow drawn downward is saying "and then, below". Merging those two
    // rows lays the sequence out sideways instead and the step is lost — the
    // one case where a shorter scene is the wrong trade.
    const stacked = bridges(a, b, ties.down)
    if (!rigid && !stacked && together.length <= 4 && width <= available) {
      rows.splice(i, 2, together)
    } else {
      i++
    }
  }

  // Left to right by where the model put things, except that whatever a unit
  // points at follows it — so a chain of arrows reads as a chain and nothing
  // unrelated is dealt between the two ends of a connector.
  const laid = rows.map((row) => orderRow(row, at, ties))

  const heights = laid.map((row) => Math.max(...row.map(unitH)))
  const content = heights.reduce((sum, height) => sum + height, 0)

  // Every gap is asked for separately, because two rows an arrow crosses need
  // more room than two rows that merely follow one another.
  const room = SCENE_H - MARGIN * 2
  const gaps: number[] = laid
    .slice(1)
    .map((row, index) => (bridges(laid[index], row, ties.down) ? LINK_GAP_Y : GAP_Y))
  let spacing = gaps.reduce((sum, gap) => sum + gap, 0)

  // Squeeze the gaps before shrinking anything: whitespace is the cheapest
  // thing to give up. Proportionally, so the rows an arrow crosses keep the
  // larger share of whatever is left.
  if (content + spacing > room && spacing > 0) {
    const scale = Math.max(0, room - content) / spacing
    for (const [index, gap] of gaps.entries()) gaps[index] = Math.max(MIN_GAP_Y, gap * scale)
    spacing = gaps.reduce((sum, gap) => sum + gap, 0)
  }

  // Spread whatever is left over into the gaps rather than banking it as a
  // margin. A board with its content bunched in the middle reads as mostly
  // empty, which is the most common complaint about a generated scene.
  const slack = room - content - spacing
  if (slack > 0 && gaps.length) {
    const share = slack / gaps.length
    for (const [index, gap] of gaps.entries()) {
      gaps[index] = gap + Math.min(share, Math.max(0, MAX_GAP_Y - gap))
    }
    spacing = gaps.reduce((sum, gap) => sum + gap, 0)
  }

  let y = MARGIN + Math.max(0, (room - content - spacing) / 2)

  for (const [index, row] of laid.entries()) {
    const height = heights[index]
    const across: number[] = row.slice(1).map((unit, i) => gapAfter(row[i], unit))
    let natural =
      row.reduce((sum, unit) => sum + unitW(unit), 0) + across.reduce((sum, gap) => sum + gap, 0)

    // The wider link gaps can push a row past the board's edge. Give the room
    // back rather than overflowing — the arrows still have more than the
    // ordinary gap to run in.
    if (natural > available && across.length) {
      const over = (natural - available) / across.length
      for (const [i, gap] of across.entries()) across[i] = Math.max(GAP_X / 2, gap - over)
      natural =
        row.reduce((sum, unit) => sum + unitW(unit), 0) + across.reduce((sum, gap) => sum + gap, 0)
    }

    // A row that nearly spans the board is stretched to span it properly;
    // a genuinely narrow row stays centred rather than being pulled apart.
    const stretch = row.length > 1 && natural > available * 0.55
    const extra = stretch ? Math.max(0, available - natural) / across.length : 0
    const width = stretch ? Math.max(natural, available) : natural

    let x = MARGIN + Math.max(0, (available - width) / 2)
    for (const [i, unit] of row.entries()) {
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
      x += unitW(unit) + (across[i] ?? 0) + (i < across.length ? extra : 0)
    }
    y += height + (gaps[index] ?? 0)
  }

  return shapes
}

/**
 * What the arrows in a scene say about which shapes belong together.
 *
 * `across` and `down` are separated because they mean different things to a
 * layout: an arrow drawn sideways asks for its ends to share a row, one drawn
 * downward asks for them not to. `flow` keeps the direction, so a chain is laid
 * out the way it is meant to be read rather than merely kept adjacent.
 */
interface Ties {
  joined: Set<string>
  across: Set<string>
  down: Set<string>
  flow: Set<string>
}

const tieKey = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`)

function tiesBetween(shapes: BoardShape[], units: Unit[]): Ties {
  const ties: Ties = { joined: new Set(), across: new Set(), down: new Set(), flow: new Set() }

  const owner = new Map<string, number>()
  for (const [index, unit] of units.entries()) {
    for (const shape of unit.shapes) owner.set(shape.id, index)
  }
  const byId = new Map(shapes.map((shape) => [shape.id, shape]))

  for (const shape of shapes) {
    if (shape.kind !== 'arrow' && shape.kind !== 'elbow') continue
    const from = shape.from ? byId.get(shape.from) : undefined
    const to = shape.to ? byId.get(shape.to) : undefined
    if (!from || !to) continue

    const a = owner.get(from.id)
    const b = owner.get(to.id)
    // Both ends inside one diagram is dagre's business, not the row layout's.
    if (a === undefined || b === undefined || a === b) continue

    const dx = to.x + occupiedWidth(to) / 2 - (from.x + occupiedWidth(from) / 2)
    const dy = to.y + occupiedHeight(to) / 2 - (from.y + occupiedHeight(from) / 2)

    const key = tieKey(a, b)
    ties.joined.add(key)
    // Sideways unless it is clearly a step down: a connector at forty-five
    // degrees was drawn by a model that had no strong opinion, and a row is the
    // more useful reading of it.
    if (Math.abs(dy) > Math.abs(dx) * 1.2) ties.down.add(key)
    else {
      ties.across.add(key)
      ties.flow.add(`${a}>${b}`)
    }
  }

  return ties
}

/**
 * Orders one row so the ends of an arrow end up side by side.
 *
 * Starts from the leftmost unit and then takes whatever that one points at,
 * falling back to anything else tied to it, and only then to the next unit
 * along. Sorting by x alone was enough while scenes were simple, but it puts an
 * unrelated caption between two boxes as readily as not.
 */
function orderRow(row: Unit[], at: (unit: Unit) => number, ties: Ties): Unit[] {
  if (row.length < 3 || !ties.joined.size) {
    return [...row].sort((a, b) => unitX(a) - unitX(b))
  }

  const rest = [...row].sort((a, b) => unitX(a) - unitX(b))
  const out: Unit[] = []

  while (rest.length) {
    let pick = 0
    if (out.length) {
      const last = at(out[out.length - 1])
      const points = rest.findIndex((unit) => ties.flow.has(`${last}>${at(unit)}`))
      const tied = rest.findIndex((unit) => ties.joined.has(tieKey(last, at(unit))))
      if (points >= 0) pick = points
      else if (tied >= 0) pick = tied
    }
    out.push(...rest.splice(pick, 1))
  }

  return out
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

  // Centre what fits; top-align what doesn't. Centring content taller than the
  // board pushes its first row to a negative y, above the top edge — which is
  // how a scene ends up with its opening shape sliced off.
  const dx = (SCENE_W - (maxX - minX)) / 2 - minX
  const dy =
    maxY - minY > SCENE_H - MARGIN * 2
      ? MARGIN - minY
      : (SCENE_H - (maxY - minY)) / 2 - minY

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

/** Room a container keeps around what it holds. */
const NEST_PAD = 26
/** Space above the children for the container's own name. */
const NEST_HEADER = 58
/** Gap between children inside a container. */
const NEST_GAP = 20
/** How long a container waits between one child and the next. */
const NEST_BEAT = 0.05

/**
 * Lays out everything that sits inside something else, and sizes the container
 * to fit it.
 *
 * The division of labour is the point. Saying a scheduler belongs inside the
 * kernel rather than beside it is a judgement about the subject; working out
 * that this makes the kernel eight hundred units wide is arithmetic, and
 * arithmetic done by guesswork is where boards go wrong. So the model says
 * what contains what and nothing else, and every number comes from here.
 *
 * Deepest first, so a container holding containers is sized only once the
 * things inside it already know how big they are.
 */
function nestChildren(shapes: BoardShape[]): BoardShape[] {
  const byId = new Map(shapes.map((shape) => [shape.id, shape]))
  const children = new Map<string, BoardShape[]>()

  for (const shape of shapes) {
    if (!shape.parent || FLOATING.has(shape.kind)) continue
    // A cycle would make depth() spin; a shape cannot be its own ancestor.
    if (ancestorOf(shape.id, shape.parent, byId)) {
      shape.parent = null
      continue
    }
    const list = children.get(shape.parent) ?? []
    list.push(shape)
    children.set(shape.parent, list)
  }
  if (!children.size) return shapes

  const parents = [...children.keys()]
    .map((id) => byId.get(id)!)
    .filter(Boolean)
    .sort((a, b) => depth(b.id, byId) - depth(a.id, byId))

  for (const parent of parents) {
    const inside = children.get(parent.id)!

    // A grid rather than a row: four things side by side inside a box makes
    // each of them a sliver, and two rows of two reads at any size.
    const columns = Math.min(inside.length <= 3 ? inside.length : 3, Math.ceil(Math.sqrt(inside.length)) + 1)
    const cellW = Math.max(...inside.map(occupiedWidth))
    const cellH = Math.max(...inside.map(occupiedHeight))
    const rows = Math.ceil(inside.length / columns)

    const header = parent.text.trim() ? NEST_HEADER : NEST_PAD
    parent.w = Math.max(parent.w, columns * cellW + (columns - 1) * NEST_GAP + NEST_PAD * 2)
    parent.h = header + rows * cellH + (rows - 1) * NEST_GAP + NEST_PAD

    const gridW = columns * cellW + (columns - 1) * NEST_GAP
    const left = parent.x + (parent.w - gridW) / 2

    for (const [index, child] of inside.entries()) {
      const column = index % columns
      const row = Math.floor(index / columns)
      // Centred in its cell, so a narrow child in a wide grid still looks placed.
      const x = left + column * (cellW + NEST_GAP) + (cellW - occupiedWidth(child)) / 2
      const y = parent.y + header + row * (cellH + NEST_GAP)

      // Whatever is already inside this child was placed while it sat
      // somewhere else — deepest first means the grandchildren were arranged
      // before their grandparent knew where anything was going. Move them by
      // the same amount, or a container arrives at its place empty and its
      // contents stay behind.
      const dx = x - child.x
      const dy = y - child.y
      child.x = x
      child.y = y
      for (const inner of descendants(child.id, children)) {
        inner.x += dx
        inner.y += dy
      }

    }
  }

  // Children need not arrive together — and mostly should not. The container is
  // drawn at its full size with nothing in it and fills as the narration names
  // each part, which is half the reason its size is worked out up front. So a
  // child given no time of its own falls a beat behind the one before it,
  // rather than the whole contents landing in a single stroke.
  //
  // Outermost first, the opposite order to sizing: a container's own moment has
  // to be final before the things inside it are spaced out behind it.
  for (const parent of [...parents].sort((a, b) => depth(a.id, byId) - depth(b.id, byId))) {
    const inside = children.get(parent.id)!
    // Squeezed if the container appears late, so a box named near the end of a
    // scene still gets all of its contents in before the narration runs out.
    const beat = Math.min(NEST_BEAT, Math.max(0, 0.95 - parent.at) / (inside.length + 1))
    let previous = parent.at

    for (const child of inside) {
      // A child with an anchor keeps its word — the player times it against the
      // audio, and this number is only the fallback.
      child.at = Math.min(
        0.95,
        child.anchor.trim()
          ? Math.max(child.at, parent.at + 0.02)
          : Math.max(child.at, previous + beat)
      )
      previous = child.at
    }
  }

  // Parent and children travel as one block through the row layout, the way a
  // diagram does — the arrangement inside has already been decided.
  for (const parent of parents) {
    const group = parent.group ?? `n${parent.id}`
    parent.group = group
    for (const child of descendants(parent.id, children)) child.group = group
  }

  return shapes
}

/**
 * Holds every shape back until whatever contains it has been drawn.
 *
 * Nesting decides the order in `at`, but the player retimes anchored shapes
 * against the real audio, and nothing stops a child's word from being spoken
 * before its container's. When that happens the child is drawn into thin air
 * and the box materialises around it a second later. A container is cheap to
 * wait for, so the child waits.
 */
export function holdInsideParents<T extends { shape: BoardShape; time: number }>(
  schedule: T[]
): T[] {
  if (!schedule.some((entry) => entry.shape.parent)) return schedule

  const byId = new Map(schedule.map((entry) => [entry.shape.id, entry]))
  const shapes = new Map(schedule.map((entry) => [entry.shape.id, entry.shape]))

  // Outermost first, so a container's own time has already settled by the time
  // anything inside it is measured against it.
  for (const entry of [...schedule].sort(
    (a, b) => depth(a.shape.id, shapes) - depth(b.shape.id, shapes)
  )) {
    const container = entry.shape.parent ? byId.get(entry.shape.parent) : undefined
    if (container) entry.time = Math.max(entry.time, container.time + 0.2)
  }

  return schedule
}

/** Every shape under this one, at any depth. */
function descendants(id: string, children: Map<string, BoardShape[]>): BoardShape[] {
  const out: BoardShape[] = []
  for (const child of children.get(id) ?? []) {
    out.push(child, ...descendants(child.id, children))
  }
  return out
}

/** How many containers deep a shape sits. */
function depth(id: string, byId: Map<string, BoardShape>): number {
  let n = 0
  let at = byId.get(id)?.parent
  while (at && n < 8) {
    n++
    at = byId.get(at)?.parent
  }
  return n
}

/** Is `id` already somewhere above `parent`? */
function ancestorOf(id: string, parent: string, byId: Map<string, BoardShape>): boolean {
  let at: string | null | undefined = parent
  for (let i = 0; at && i < 8; i++) {
    if (at === id) return true
    at = byId.get(at)?.parent
  }
  return false
}

/** Breathing room a grouping frame keeps around the shapes it encloses. */
const FRAME_PAD = 34

/**
 * Ties a grouping frame to the shapes inside it.
 *
 * A frame is a large empty dashed box drawn behind a group to say "all of this
 * is one thing" — a service, a machine, a phase. On its own the row layout
 * would treat it as just another shape and deal it out into a band of its own,
 * leaving an empty rectangle above the group it was meant to enclose.
 *
 * So containment is worked out here, from the coordinates the model chose,
 * while they still mean something. The frame and its contents become one group,
 * which the layout then moves as a single rigid block — the same mechanism a
 * Mermaid diagram already uses.
 *
 * Containment is decided here, before the arrow-label spacer runs — that pass
 * pushes shapes rightward and would carry half a group out through the side of
 * its own frame. The frame's box is fitted to its members afterwards, by
 * fitFrames, once nothing is moving any more.
 */
function groupFrames(shapes: BoardShape[]): BoardShape[] {
  const frames = shapes.filter(
    (shape) =>
      shape.kind === 'box' &&
      !shape.text.trim() &&
      (shape.dash === 'dashed' || shape.dash === 'dotted') &&
      !shape.group
  )
  if (!frames.length) return shapes

  // Biggest first, so a frame inside a frame claims its contents second.
  for (const [i, frame] of frames.sort((a, b) => b.w * b.h - a.w * a.h).entries()) {
    if (frame.group) continue

    const inside = shapes.filter(
      (shape) =>
        shape !== frame &&
        !shape.group &&
        !FLOATING.has(shape.kind) &&
        shape.x >= frame.x - 12 &&
        shape.y >= frame.y - 12 &&
        shape.x + occupiedWidth(shape) <= frame.x + frame.w + 12 &&
        shape.y + occupiedHeight(shape) <= frame.y + frame.h + 12
    )
    // One shape in a box is a box, not a region.
    if (inside.length < 2) continue

    const group = `f${i}`
    frame.group = group
    // A filled frame would hide what it encloses.
    frame.fill = 'none'
    for (const shape of inside) shape.group = group

    // An arrow with both ends in the region belongs to it too — not for the
    // layout, which never moves a connector, but so the label lifted off it
    // later counts as part of the region and the frame is drawn around it.
    const held = new Set(inside.map((shape) => shape.id))
    for (const shape of shapes) {
      if (shape.kind !== 'arrow' || shape.group) continue
      if (shape.from && shape.to && held.has(shape.from) && held.has(shape.to)) {
        shape.group = group
      }
    }

    // Behind, and drawn before anything it contains.
    frame.at = Math.max(0, Math.min(...inside.map((shape) => shape.at)) - 0.02)
  }

  return shapes
}

/**
 * Redraws each grouping frame around whatever its members ended up as.
 *
 * The model's own rectangle is only ever a hint at which shapes belong
 * together — by the time the spacing pass has opened up room for arrow labels,
 * it fits nothing. So the box is thrown away and rebuilt from the contents.
 */
function fitFrames(shapes: BoardShape[]): BoardShape[] {
  const framed = new Map<string, BoardShape[]>()
  for (const shape of shapes) {
    if (!shape.group?.startsWith('f')) continue
    const list = framed.get(shape.group) ?? []
    list.push(shape)
    framed.set(shape.group, list)
  }

  for (const members of framed.values()) {
    const frame = members.find((shape) => !shape.text.trim() && shape.kind === 'box')
    const inside = members.filter((shape) => shape !== frame && !FLOATING.has(shape.kind))
    if (!frame || !inside.length) continue

    const bounds = boundsOf(inside)
    frame.x = bounds.x - FRAME_PAD
    frame.y = bounds.y - FRAME_PAD
    frame.w = bounds.w + FRAME_PAD * 2
    frame.h = bounds.h + FRAME_PAD * 2
  }

  return shapes
}

/**
 * Puts each ring back around the thing it was drawn to circle.
 *
 * A ring carries no reference to its target — the model expresses "this one
 * matters" by drawing a circle over the top of it. Those coordinates stop
 * meaning anything the moment the row layout moves everything, so the target is
 * worked out from where the ring started, and the ring is redrawn around
 * wherever that shape ended up.
 *
 * @param before each shape's centre as the model placed it, before layout.
 */
function attachRings(
  shapes: BoardShape[],
  before: Map<string, { x: number; y: number; w: number; h: number }>
) {
  const rings = shapes.filter((shape) => shape.kind === 'ring')
  if (!rings.length) return shapes

  const targets = shapes.filter(
    (shape) => !FLOATING.has(shape.kind) && shape.text.trim() && before.has(shape.id)
  )
  if (!targets.length) return shapes

  for (const ring of rings) {
    const drawn = before.get(ring.id)
    if (!drawn) continue
    const from = { x: drawn.x + drawn.w / 2, y: drawn.y + drawn.h / 2 }

    let best: BoardShape | null = null
    let nearest = Infinity
    for (const target of targets) {
      const box = before.get(target.id)!
      const at = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
      const distance = Math.hypot(at.x - from.x, at.y - from.y)
      if (distance < nearest) {
        nearest = distance
        best = target
      }
    }
    if (!best) continue

    // Thrown around it by hand, so a little wider than the thing itself.
    const padX = 26
    const padY = 18
    ring.x = best.x - padX
    ring.y = best.y - padY
    ring.w = occupiedWidth(best) + padX * 2
    ring.h = occupiedHeight(best) + padY * 2
    ring.at = Math.max(ring.at, best.at)
  }

  return shapes
}

/** The freehand gestures: drawn over the board, not packed into it. */
const GESTURES = new Set<ShapeKind>(['curve', 'line', 'highlight'])

/**
 * Carries each freehand gesture along with whatever it was drawn over.
 *
 * A highlight, an underline or a brace is defined by absolute
 * points, and the row layout deliberately never touches them — a connector
 * that re-routes itself is right, a marker stroke that reshapes itself is not.
 * But that left them pinned to coordinates the rest of the scene has since
 * moved away from, so a sweep meant to run along a row of boxes ended up
 * sweeping the empty board those boxes used to occupy.
 *
 * So each gesture is tied to the shape it started nearest and moved by exactly
 * that shape's displacement. The stroke keeps its own shape and its meaning:
 * still over the thing it was aimed at.
 *
 * @param before every shape's centre before the layout rewrote it.
 */
function carryGestures(
  shapes: BoardShape[],
  before: Map<string, { x: number; y: number; w: number; h: number }>
) {
  const gestures = shapes.filter(
    (shape) => GESTURES.has(shape.kind) && !shape.group && shape.points.length >= 2
  )
  if (!gestures.length) return shapes

  // How far each solid shape travelled, keyed by where it started.
  const moved = shapes
    .filter((shape) => !FLOATING.has(shape.kind) && before.has(shape.id))
    .map((shape) => {
      const box = before.get(shape.id)!
      const from = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
      return {
        from,
        dx: shape.x + occupiedWidth(shape) / 2 - from.x,
        dy: shape.y + occupiedHeight(shape) / 2 - from.y,
      }
    })
  if (!moved.length) return shapes

  for (const gesture of gestures) {
    const box = before.get(gesture.id)
    if (!box) continue
    const at = { x: box.x + box.w / 2, y: box.y + box.h / 2 }

    let nearest = moved[0]
    let best = Infinity
    for (const candidate of moved) {
      const distance = Math.hypot(candidate.from.x - at.x, candidate.from.y - at.y)
      if (distance < best) {
        best = distance
        nearest = candidate
      }
    }

    gesture.x += nearest.dx
    gesture.y += nearest.dy
    for (const point of gesture.points) {
      point.x += nearest.dx
      point.y += nearest.dy
    }
  }

  return shapes
}

/** Widest an arrow's label block may grow before it wraps to another line. */
const EDGE_LABEL_W = 240

/**
 * Measures the block an arrow's label will occupy once it is lifted off the
 * arrow and set beside it.
 *
 * The first line is the label proper; anything after it is the small print,
 * set smaller and in grey. Both are wrapped to the same column so the block
 * reads as one caption rather than two stray pieces of text.
 */
function edgeLabelBox(arrow: BoardShape) {
  const lines = arrow.text.split('\n').map((line) => line.trim()).filter(Boolean)
  const head = lines[0] ?? ''
  const caption = lines.slice(1).join(' ')

  const w = Math.max(
    90,
    Math.min(EDGE_LABEL_W, Math.max(labelWidth(head, arrow.size), labelWidth(caption, 's')))
  )
  const headH = Math.ceil(labelWidth(head, arrow.size) / w) * LINE_HEIGHT[arrow.size]
  const capH = caption ? Math.ceil(labelWidth(caption, 's') / w) * LINE_HEIGHT.s : 0

  return { head, caption, w, headH, capH, h: headH + capH }
}

/**
 * Takes each bound arrow's label off the arrow and sets it beside the line.
 *
 * tldraw fits an arrow's label inside the arrow's own span, which is why the
 * prompt has always capped labels at three words: anything longer wraps to two
 * characters a line and lands on the shapes at each end. But the label is where
 * the real information lives — "validate and store", "read user, write login
 * logs" — and a three-word ceiling throws most of it away.
 *
 * So the label becomes ordinary text on the board, sitting above a horizontal
 * link or beside a vertical one, exactly where a hand would have written it.
 * The arrow keeps the line and loses the lettering.
 *
 * Runs after layout, because it needs the positions the shapes actually ended
 * up with.
 */
function liftArrowLabels(shapes: BoardShape[]): BoardShape[] {
  const byId = new Map(shapes.map((shape) => [shape.id, shape]))
  const lifted: BoardShape[] = []

  for (const arrow of shapes) {
    if (arrow.kind !== 'arrow' || !arrow.from || !arrow.to || !arrow.text.trim()) continue

    const a = byId.get(arrow.from)
    const b = byId.get(arrow.to)
    if (!a || !b) continue

    const box = edgeLabelBox(arrow)
    if (!box.head) continue

    const from = { x: a.x + occupiedWidth(a) / 2, y: a.y + occupiedHeight(a) / 2 }
    const to = { x: b.x + occupiedWidth(b) / 2, y: b.y + occupiedHeight(b) / 2 }
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }

    // A horizontal link has its gap to the sides, so the label goes above the
    // line; a vertical one has room beside it and nowhere above.
    const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
    let x = horizontal ? mid.x - box.w / 2 : mid.x + 16
    let y = horizontal ? mid.y - 14 - box.h : mid.y - box.h / 2

    // Nothing has reserved this spot. A link that crosses the board — and every
    // diagram edge that skips a rank — puts its midpoint straight through
    // whatever happens to be there, so back the label off until it is clear.
    for (let attempt = 0; attempt < 6; attempt++) {
      const clash = shapes.some(
        (other) =>
          other !== arrow &&
          !FLOATING.has(other.kind) &&
          !(other.kind === 'box' && !other.text.trim()) &&
          x < other.x + occupiedWidth(other) &&
          other.x < x + box.w &&
          y < other.y + occupiedHeight(other) &&
          other.y < y + box.h
      )
      if (!clash) break
      if (horizontal) y -= box.h + 12
      else x += box.w + 12
    }

    lifted.push({
      ...arrow,
      id: `${arrow.id}~l`,
      kind: 'text',
      text: box.head,
      x,
      y,
      w: box.w,
      h: box.headH,
      from: null,
      to: null,
      color: arrow.color,
      fill: 'none',
      points: [],
      data: [],
    })

    if (box.caption) {
      lifted.push({
        ...arrow,
        id: `${arrow.id}~c`,
        kind: 'text',
        text: box.caption,
        x,
        y: y + box.headH,
        w: box.w,
        h: box.capH,
        from: null,
        to: null,
        // Grey is what every reference board uses for the line under the line.
        color: 'grey',
        fill: 'none',
        size: 's',
        points: [],
        data: [],
      })
    }

    arrow.text = ''
  }

  return lifted.length ? [...shapes, ...lifted] : shapes
}

/**
 * Opens up horizontal room for arrow labels.
 *
 * A label set beside its arrow still has to fit in the gap between the shapes
 * it joins, so this pass measures each one and pushes the downstream shapes
 * right until it does. The prompt asks for generous gaps, but the model is not
 * reliable about it.
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
      const needed = edgeLabelBox(arrow).w + 40
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
