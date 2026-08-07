/**
 * The scene language for the manim engine.
 *
 * Manim scenes are normally *code* — you write `self.play(Create(circle))`. The
 * model could write that code and we could run it, but executing model-authored
 * code is a door worth not opening: a topic is user input, and a
 * prompt-injected one would be running on the server.
 *
 * So a lesson declares mobjects and the steps that animate them, and
 * `lib/manim-python.ts` compiles that into the script. It also fits how
 * everything else here works: strict structured outputs, scene-at-a-time
 * streaming, and `anchor` timing that lands each step on the words describing
 * it.
 *
 * Coordinates are manim's own: the frame is 14.22 x 8 units with the origin at
 * the centre, so x runs about -7 to 7 and y about -4 to 4.
 */

export const FRAME_W = 14.22
export const FRAME_H = 8

export const MOBJECT_KINDS = [
  'circle',
  'ellipse',
  'dot',
  'square',
  'rectangle',
  'triangle',
  'polygon',
  /** A regular n-gon; `sides` picks n. */
  'regularPolygon',
  'line',
  'dashedLine',
  'arrow',
  /** An arrow rooted at the origin — the one to use for forces and fields. */
  'vector',
  'arc',
  'text',
  /** Set in a serif face, for formulae. No LaTeX pipeline behind it. */
  'math',
  'axes',
  /** A curve of `text` (an expression in x) drawn on the axes named by `of`. */
  'plot',
  'numberPlane',
  /** A box drawn around the mobject named by `of`, for calling it out. */
  'surround',
  'group',
] as const

export type MobjectKind = (typeof MOBJECT_KINDS)[number]

/** manim's palette, by name. The player maps these to the library's constants. */
export const MANIM_COLORS = [
  'white',
  'grey',
  'blue',
  'teal',
  'green',
  'yellow',
  'gold',
  'red',
  'maroon',
  'purple',
  'pink',
  'orange',
] as const

export const ACTIONS = [
  /** Draws an outline on, stroke following the path. The manim default. */
  'create',
  /** For text: letters appear in order, as if written. */
  'write',
  'fadeIn',
  'fadeOut',
  'uncreate',
  /** Morphs `targets[0]` into the shape of `to`. */
  'transform',
  'grow',
  'shrink',
  'spiralIn',
  /** A brief swell, for pointing at something already on screen. */
  'indicate',
  'flash',
  'wiggle',
  /** Traces a box around it and fades the box out. */
  'circumscribe',
  'rotate',
  'shift',
  'scale',
  'moveTo',
  /** Holds, so a diagram gets a beat before the next thing lands. */
  'wait',
] as const

export type Action = (typeof ACTIONS)[number]

export interface ManimMobject {
  id: string
  kind: MobjectKind
  /** Text content, or for `plot` the expression in x — "sin(x)", "x^2 - 1". */
  text: string
  /** Centre, in frame units. */
  x: number
  y: number
  /** Width and height in frame units; for a circle, w is the diameter. */
  w: number
  h: number
  /** Polygon vertices, or the two endpoints of a line or arrow. */
  points: { x: number; y: number }[]
  /** Sides of a regular polygon. */
  sides: number
  /** The mobject this one refers to: what `surround` boxes, what `plot` plots on. */
  of: string | null
  /** Children of a `group`. */
  members: string[]
  color: (typeof MANIM_COLORS)[number]
  /** Fill opacity, 0 to 1. Outlines read better than solids for most diagrams. */
  fill: number
  /** Rotation in degrees, applied when the mobject is built. */
  angle: number
  /** Font size for text and math. manim's default is 48. */
  size: number
  /** Axes only: [min, max, step] on each axis. */
  xRange: number[]
  yRange: number[]
}

export interface ManimStep {
  id: string
  action: Action
  /** Mobject ids this step animates. Several run together. */
  targets: string[]
  /** Where a `transform` lands. */
  to: string | null
  /** Displacement for `shift`, or destination for `moveTo`, in frame units. */
  dx: number
  dy: number
  /** Factor for `scale`. */
  factor: number
  /** Degrees for `rotate`. */
  angle: number
  /** Seconds. */
  runTime: number
  /** Stagger between targets, 0 for together and 1 for strictly one by one. */
  lag: number
  /** The phrase in the narration this step illustrates. */
  anchor: string
  /** Fallback position in the scene, 0 to 1, when the phrase can't be matched. */
  at: number
}

export interface ManimScene {
  id: string
  narration: string
  mobjects: ManimMobject[]
  steps: ManimStep[]
}

export interface ManimLesson {
  title: string
  summary: string
  scenes: ManimScene[]
}

/**
 * Strict JSON schema for structured outputs. Strict mode wants every property
 * in `required` and forbids extra keys, so optional fields are nullable rather
 * than absent.
 */
export const MANIM_SCENE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'narration', 'mobjects', 'steps'],
  properties: {
    id: { type: 'string' },
    narration: { type: 'string' },
    mobjects: {
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
          'points',
          'sides',
          'of',
          'members',
          'color',
          'fill',
          'angle',
          'size',
          'xRange',
          'yRange',
        ],
        properties: {
          id: { type: 'string' },
          kind: { type: 'string', enum: [...MOBJECT_KINDS] },
          text: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          w: { type: 'number' },
          h: { type: 'number' },
          points: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['x', 'y'],
              properties: { x: { type: 'number' }, y: { type: 'number' } },
            },
          },
          sides: { type: 'number' },
          of: { type: ['string', 'null'] },
          members: { type: 'array', items: { type: 'string' } },
          color: { type: 'string', enum: [...MANIM_COLORS] },
          fill: { type: 'number' },
          angle: { type: 'number' },
          size: { type: 'number' },
          xRange: { type: 'array', items: { type: 'number' } },
          yRange: { type: 'array', items: { type: 'number' } },
        },
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'action',
          'targets',
          'to',
          'dx',
          'dy',
          'factor',
          'angle',
          'runTime',
          'lag',
          'anchor',
          'at',
        ],
        properties: {
          id: { type: 'string' },
          action: { type: 'string', enum: [...ACTIONS] },
          targets: { type: 'array', items: { type: 'string' } },
          to: { type: ['string', 'null'] },
          dx: { type: 'number' },
          dy: { type: 'number' },
          factor: { type: 'number' },
          angle: { type: 'number' },
          runTime: { type: 'number' },
          lag: { type: 'number' },
          anchor: { type: 'string' },
          at: { type: 'number' },
        },
      },
    },
  },
} as const

export const MANIM_LESSON_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'scenes'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    scenes: { type: 'array', items: MANIM_SCENE_JSON_SCHEMA },
  },
} as const

export const MANIM_ANSWER_JSON_SCHEMA = MANIM_SCENE_JSON_SCHEMA

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min

/**
 * Repairs a scene into something that will build and play.
 *
 * The rules that matter are the referential ones: a step naming a mobject that
 * was never declared would throw mid-animation and take the rest of the scene
 * with it, so those are dropped here rather than defended against in the
 * player.
 */
export function normalizeManimScene(scene: ManimScene, sceneIndex: number): ManimScene {
  const seen = new Set<string>()
  const mobjects: ManimMobject[] = []

  for (const [i, raw] of (scene.mobjects ?? []).entries()) {
    if (!raw) continue

    let id = raw.id || `m${i}`
    while (seen.has(id)) id = `${id}_${i}`
    seen.add(id)

    const kind = MOBJECT_KINDS.includes(raw.kind) ? raw.kind : 'circle'

    mobjects.push({
      ...raw,
      id,
      kind,
      text: raw.text ?? '',
      // Half a frame of slack past the edge: a mobject may legitimately start
      // off-screen and be shifted in.
      x: clamp(raw.x ?? 0, -FRAME_W, FRAME_W),
      y: clamp(raw.y ?? 0, -FRAME_H, FRAME_H),
      w: clamp(raw.w ?? 1, 0.05, FRAME_W),
      h: clamp(raw.h ?? 1, 0.05, FRAME_H),
      points: Array.isArray(raw.points) ? raw.points.filter((p) => p && Number.isFinite(p.x)) : [],
      sides: Math.round(clamp(raw.sides ?? 6, 3, 20)),
      of: raw.of || null,
      members: Array.isArray(raw.members) ? raw.members : [],
      color: MANIM_COLORS.includes(raw.color) ? raw.color : 'white',
      fill: clamp(raw.fill ?? 0, 0, 1),
      angle: Number.isFinite(raw.angle) ? raw.angle : 0,
      size: clamp(raw.size ?? 40, 12, 140),
      xRange: normalizeRange(raw.xRange, [-5, 5, 1]),
      yRange: normalizeRange(raw.yRange, [-3, 3, 1]),
    })
  }

  for (const mobject of mobjects) keepInFrame(mobject)

  const byId = new Map(mobjects.map((m) => [m.id, m]))

  // A reference to something that doesn't exist can't be built, and a group
  // that ends up empty has nothing to animate.
  for (const mobject of mobjects) {
    if (mobject.of && !byId.has(mobject.of)) mobject.of = null
    mobject.members = mobject.members.filter((id) => byId.has(id) && id !== mobject.id)
  }

  const steps: ManimStep[] = []
  let previousAt = 0

  for (const [i, raw] of (scene.steps ?? []).entries()) {
    if (!raw) continue

    const action = ACTIONS.includes(raw.action) ? raw.action : 'create'
    const targets = (Array.isArray(raw.targets) ? raw.targets : []).filter((id) => byId.has(id))
    // `wait` is the one action that legitimately animates nothing.
    if (!targets.length && action !== 'wait') continue

    const to = raw.to && byId.has(raw.to) ? raw.to : null
    if (action === 'transform' && !to) continue

    // Monotonic, so steps play in the order they were written even when the
    // model's fractions wander.
    const at = Math.max(previousAt, clamp(raw.at ?? i / 10, 0, 1))
    previousAt = at

    steps.push({
      ...raw,
      id: raw.id || `step${i}`,
      action,
      targets,
      to,
      dx: clamp(raw.dx ?? 0, -FRAME_W, FRAME_W),
      dy: clamp(raw.dy ?? 0, -FRAME_H, FRAME_H),
      factor: clamp(raw.factor ?? 1, 0.05, 20),
      angle: Number.isFinite(raw.angle) ? raw.angle : 0,
      runTime: clamp(raw.runTime ?? 1, 0.2, 8),
      lag: clamp(raw.lag ?? 0, 0, 1),
      anchor: raw.anchor ?? '',
      at,
    })
  }

  return {
    id: scene.id || `scene${sceneIndex}`,
    narration: scene.narration ?? '',
    mobjects,
    steps,
  }
}

/**
 * Kinds whose footprint is centre ± size. The rest place themselves from
 * explicit points, or from another mobject, so there is no box to move.
 */
const BOUNDED = new Set<MobjectKind>([
  'circle',
  'ellipse',
  'dot',
  'square',
  'rectangle',
  'triangle',
  'regularPolygon',
  'arc',
  'text',
  'math',
  'axes',
  'numberPlane',
])

/**
 * Slides a mobject in until its whole extent is on screen.
 *
 * The clamps above bound the centre, which is not the same thing: a circle
 * centred just inside the edge still has half of it hanging off, and the render
 * shows it sliced. Anything too big to fit is centred instead, since there is
 * no position that would help.
 */
function keepInFrame(mobject: ManimMobject) {
  if (!BOUNDED.has(mobject.kind)) return

  const margin = 0.2
  const limitX = FRAME_W / 2 - mobject.w / 2 - margin
  const limitY = FRAME_H / 2 - mobject.h / 2 - margin

  mobject.x = limitX <= 0 ? 0 : clamp(mobject.x, -limitX, limitX)
  mobject.y = limitY <= 0 ? 0 : clamp(mobject.y, -limitY, limitY)
}

function normalizeRange(raw: number[] | undefined, fallback: [number, number, number]) {
  if (!Array.isArray(raw) || raw.length < 2) return fallback
  const [min, max, step] = raw
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return fallback
  const span = max - min
  return [min, max, Number.isFinite(step) && step > 0 ? step : span / 8]
}

export function isRenderableManimScene(
  scene: ManimScene | null | undefined
): scene is ManimScene {
  return Boolean(scene?.mobjects?.length)
}

export function normalizeManimLesson(raw: ManimLesson): ManimLesson {
  return {
    title: raw.title ?? '',
    summary: raw.summary ?? '',
    scenes: (raw.scenes ?? []).map(normalizeManimScene),
  }
}
