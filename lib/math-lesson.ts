/**
 * The notebook language.
 *
 * A maths explainer is not a board and not a slide. It is a page: you write a
 * line, you say why, you write the next line underneath, and by the bottom the
 * thing is solved. Everything here exists to make that shape easy to say and
 * hard to get wrong — the model writes lines of working and what each one came
 * from, and every position on the page is worked out here.
 *
 * Coordinates are Manim's: the origin is the middle of the frame, y increases
 * upward, and the frame is FRAME_W by FRAME_H world units.
 */

export const FRAME_W = 14.22
export const FRAME_H = 8

/** Left edge of the working column, and of the margin beside it. */
export const COLUMN_X = -FRAME_W / 2 + 1.1
export const MARGIN_X = 2.4

/** Vertical space one line of working takes. */
export const LINE_STEP = 1.15
/** Where the first line of a page sits. */
export const PAGE_TOP = FRAME_H / 2 - 1.3

export const STEP_KINDS = [
  /** A line of working, set in maths. */
  'line',
  /** A line that restates the one it came from, rewritten in place. */
  'rewrite',
  /** Words, not maths: what the line above is doing, out in the margin. */
  'note',
  /** A short heading over the next stretch of working — "check it". */
  'label',
  /** A ruled line across the column, the way you underline a section. */
  'rule',
  /** The answer, boxed. */
  'result',
  /** A box drawn around an earlier line, to say "this one". */
  'mark',
] as const

export type StepKind = (typeof STEP_KINDS)[number]

export const MATH_COLORS = [
  'ink',
  'blue',
  'red',
  'green',
  'violet',
  'orange',
  'grey',
] as const

export type MathColor = (typeof MATH_COLORS)[number]

/** Ink on paper, not chalk on slate. */
export const INK: Record<MathColor, string> = {
  ink: '#1d2733',
  blue: '#2f6fb5',
  red: '#c0392b',
  green: '#1e8a5a',
  violet: '#7d4bb5',
  orange: '#c9752b',
  grey: '#8a94a3',
}

export const PAPER = '#faf7f0'
export const RULE = '#dfe3ea'

export interface MathStep {
  /** Unique within the scene. A rewrite names the line it came from. */
  id: string
  kind: StepKind
  /**
   * LaTeX for the maths kinds, plain words for `note` and `label`.
   *
   * No dollar signs and no `\\begin{}` — one expression, as you would write it
   * on a line.
   */
  tex: string
  /** The id this step rewrites, boxes or annotates. */
  from: string | null
  color: MathColor
  /** The exact words from the narration this step is written on. */
  anchor: string
  /** Fallback position through the narration, 0 to 1. */
  at: number
}

export interface MathScene {
  id: string
  heading: string
  narration: string
  steps: MathStep[]
}

export interface MathLesson {
  title: string
  summary: string
  scenes: MathScene[]
}

/** Laid-out step: everything the renderer needs and nothing it has to work out. */
export interface PlacedStep extends MathStep {
  x: number
  y: number
  /** Which line of the page it occupies. Notes share their subject's line. */
  row: number
  /** Font scale, from the kind. */
  scale: number
}

const STEP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'kind', 'tex', 'from', 'color', 'anchor', 'at'],
  properties: {
    id: { type: 'string' },
    kind: { type: 'string', enum: STEP_KINDS },
    tex: { type: 'string' },
    from: { type: ['string', 'null'] },
    color: { type: 'string', enum: MATH_COLORS },
    anchor: { type: 'string' },
    at: { type: 'number' },
  },
} as const

export const MATH_SCENE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'heading', 'narration', 'steps'],
  properties: {
    id: { type: 'string' },
    heading: { type: 'string' },
    narration: { type: 'string' },
    steps: { type: 'array', items: STEP_SCHEMA },
  },
} as const

export const MATH_LESSON_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'scenes'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    scenes: { type: 'array', items: MATH_SCENE_JSON_SCHEMA },
  },
} as const

/** How much room each kind takes, and how big it is set. */
const SCALE: Record<StepKind, number> = {
  line: 1,
  rewrite: 1,
  note: 0.62,
  label: 0.7,
  rule: 1,
  result: 1.15,
  mark: 1,
}

/** Rows a kind consumes on the page. A note is written beside, not below. */
const ROWS: Record<StepKind, number> = {
  line: 1,
  rewrite: 1,
  note: 0,
  label: 0.8,
  rule: 0.5,
  result: 1.3,
  mark: 0,
}

/**
 * Places every step on the page.
 *
 * The rule is the one a person follows without thinking: each new line goes
 * under the last, a rewrite replaces the line it came from rather than taking a
 * row of its own, and anything that comments on a line sits out in the margin
 * level with it. Nothing here is a decision the model should be making — it
 * writes the working, this decides where the working goes.
 */
export function normalizeMathScene(scene: MathScene, sceneIndex: number): MathScene {
  const seen = new Set<string>()
  const steps: MathStep[] = []

  for (const [i, raw] of (scene.steps ?? []).entries()) {
    if (!raw) continue

    let id = raw.id || `s${i}`
    while (seen.has(id)) id = `${id}_`
    seen.add(id)

    const kind = STEP_KINDS.includes(raw.kind) ? raw.kind : 'line'
    steps.push({
      id,
      kind,
      tex: typeof raw.tex === 'string' ? raw.tex.trim().slice(0, 240) : '',
      from: raw.from || null,
      color: MATH_COLORS.includes(raw.color) ? raw.color : 'ink',
      anchor: typeof raw.anchor === 'string' ? raw.anchor.trim().slice(0, 60) : '',
      at: clamp(Number.isFinite(raw.at) ? raw.at : i / Math.max(1, (scene.steps ?? []).length), 0, 0.97),
    })
  }

  // A reference to a line that was never written is worse than none: a rewrite
  // with nothing to rewrite would sit on top of whatever is there.
  const ids = new Set(steps.map((step) => step.id))
  for (const step of steps) {
    if (step.from && (!ids.has(step.from) || step.from === step.id)) step.from = null
    // These three are only meaningful against an earlier line.
    if (!step.from && (step.kind === 'rewrite' || step.kind === 'mark')) step.kind = 'line'
  }

  return {
    id: scene.id || `page-${sceneIndex + 1}`,
    heading: scene.heading || '',
    narration: (scene.narration ?? '').trim(),
    steps: steps.sort((a, b) => a.at - b.at),
  }
}

/**
 * Works out where each step lands, in reading order.
 *
 * Separate from normalizing because the renderer needs it and the checker wants
 * it, and neither should have to know the arithmetic.
 */
export function placeSteps(scene: MathScene): PlacedStep[] {
  const placed: PlacedStep[] = []
  const byId = new Map<string, PlacedStep>()
  let row = 0

  for (const step of scene.steps) {
    const scale = SCALE[step.kind]

    // A rewrite lands exactly where the line it replaces is, because that is
    // what makes the change legible: the terms that survive stay put and only
    // what changed moves.
    const target = step.from ? byId.get(step.from) : undefined
    if ((step.kind === 'rewrite' || step.kind === 'mark') && target) {
      const at = { ...step, x: target.x, y: target.y, row: target.row, scale }
      placed.push(at)
      byId.set(step.id, at)
      continue
    }

    // A note sits in the margin, level with whatever it is about — or with the
    // line just written, when it does not say.
    if (step.kind === 'note') {
      const beside = target ?? placed.filter((p) => p.kind !== 'note').at(-1)
      const at = {
        ...step,
        x: COLUMN_X + MARGIN_X + 3.9,
        y: beside ? beside.y : PAGE_TOP - row * LINE_STEP,
        row: beside ? beside.row : row,
        scale,
      }
      placed.push(at)
      byId.set(step.id, at)
      continue
    }

    const at = {
      ...step,
      x: COLUMN_X + (step.kind === 'result' ? 0.6 : 0),
      y: PAGE_TOP - row * LINE_STEP,
      row,
      scale,
    }
    placed.push(at)
    byId.set(step.id, at)
    row += ROWS[step.kind]
  }

  return placed
}

/**
 * How far the page has to scroll for a step to be on screen.
 *
 * A long solve runs off the bottom, and the answer is the one thing that must
 * never be off screen. So the camera follows the pen down the page, a page at a
 * time rather than continuously — a view that slides on every line is unreadable.
 */
export function pageOffset(step: PlacedStep) {
  const lowest = PAGE_TOP - (FRAME_H - 2.2)
  if (step.y >= lowest) return 0
  return Math.ceil((lowest - step.y) / (FRAME_H - 3)) * (FRAME_H - 3)
}

export function isRenderableMathScene(scene: MathScene | null | undefined): scene is MathScene {
  return Boolean(scene && scene.narration?.trim() && Array.isArray(scene.steps))
}

export function normalizeMathLesson(raw: MathLesson): MathLesson {
  return {
    title: raw.title || 'Worked through',
    summary: raw.summary || '',
    scenes: (raw.scenes ?? []).map(normalizeMathScene),
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
