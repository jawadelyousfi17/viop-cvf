import type { BoardShape, Scene } from './lesson'
import { drawing, type PlotSpec } from './plot'

/**
 * A worked solution, laid out down a board.
 *
 * The shape of the thing is the argument, not the answer: a step is a claim,
 * the reason for it, and the line of algebra it produces. Which is why a step
 * here is three fields rather than one blob of markdown — the prose and the
 * mathematics are set differently, and a solution where you cannot skim the
 * equations without reading the words is a solution nobody checks.
 *
 * Rendered by the SVG engine in components/engine, with KaTeX inside the same
 * foreignObject the board already uses for text.
 */

export interface MathStep {
  /**
   * Why, in a sentence or two, in the voice of someone at a board.
   *
   * There is no heading beside it. A worked solution is one argument read top
   * to bottom, and a label over every few lines of it — "Factor the
   * denominator", "Apply the chain rule" — cuts that argument into sections
   * and says each one twice: once as a title and once as the sentence under
   * it. What the step does is what the sentence and the line of algebra
   * already show.
   */
  say: string
  /** The line of mathematics it produces, as LaTeX. Empty when there is none. */
  math: string
  /**
   * A graph, when seeing it is the explanation.
   *
   * Null on most steps. A picture of the algebra you have just done is noise;
   * a picture of where the roots are, or of why two curves meet twice, is the
   * step itself.
   */
  plot: PlotSpec | null
  /**
   * That line, read aloud: "two x squared minus four x minus six equals zero".
   *
   * A speech engine hands `2x^2` back as "two x two" or worse, so the words
   * are written out rather than derived. Empty when the line is better left
   * unread — a long expression said in full is harder to follow than the
   * sentence about it.
   */
  spoken: string
}

export interface MathSolution {
  title: string
  /** The problem as the tutor understands it — LaTeX, so it can be checked. */
  given: string
  /** The problem read aloud, so the tutor opens by stating it. */
  givenSpoken: string
  steps: MathStep[]
  /** The result on its own, and the sentence that says what it means. */
  answer: string
  /** The answer, read aloud. Same reason as a step's `spoken`. */
  answerSpoken: string
  answerNote: string
  /** The check: substituting back, a sanity bound, a unit. Empty when there is none. */
  check: string
}

/* ---------------------------------------------------------------- layout --- */

/**
 * The page.
 *
 * The column starts just right of the margin rule the canvas draws at 470, so
 * the working sits where it would in a notebook: everything inside the margin,
 * nothing crossing it.
 */
const MARGIN = 70
const COL_X = 500
const COL_W = 900
const TITLE_H = 48
const GIVEN_H = 64

/**
 * The writing column, in board units.
 *
 * Exported because the camera reads it: this side of the app is a page and not
 * a canvas, so the width is settled here and the view only ever scrolls down
 * it. See BoardCanvas's `column`.
 */
export const MATH_COLUMN = { x: COL_X, w: COL_W }

/** Between one step and the next. Prose and its own line of algebra sit closer. */
const STEP_GAP = 24
/** Between a sentence and the line of mathematics it produces. */
const SAY_GAP = 4
/**
 * A plain line of mathematics, set at 21px by KaTeX.
 *
 * Close to what one actually stands, because the line is centred in this box:
 * every unit of slack here becomes half a unit of white space above the
 * equation, opening a gap between it and the sentence that introduces it.
 */
const MATH_H = 50

/**
 * How tall a line of mathematics actually stands.
 *
 * A fraction is two lines and a rule; a nested fraction is three. KaTeX knows
 * this and the box does not, so a flat height clips exactly the lines worth
 * showing — the ones where the working got interesting. Counted from the
 * source rather than measured, because the layout runs before anything is
 * typeset.
 */
function mathHeight(latex: string) {
  const stacked = (latex.match(/\\[dt]?frac|\\binom/g) ?? []).length
  const deep = /\\[dt]?frac[^{]*\{[^{}]*\\[dt]?frac/.test(latex)
  const big = /\\(sum|prod|int|lim)\b/.test(latex)
  const cases = (latex.match(/\\\\/g) ?? []).length

  return (
    MATH_H +
    (stacked ? 38 : 0) +
    (deep ? 30 : 0) +
    (big ? 18 : 0) +
    cases * 34
  )
}
/** A graph is a square-ish window, big enough to read a turning point off. */
const PLOT_W = 560
const PLOT_H = 360
const ANSWER_H = 72

/** Type sizes, kept in step with components/engine/palette.ts. */
const TYPE = { s: 19, m: 25, l: 34 } as const
/** The line height Shape.tsx sets on a prose box. */
const LEADING = 1.15
/** The horizontal padding it sets, which the text does not get to use. */
const TEXT_PAD = 4

/**
 * How tall a paragraph stands.
 *
 * Measured, when there is a browser to ask: the box is a fixed frame with the
 * text clipped to it, so a count that runs long leaves white space under every
 * paragraph on the page — and the thing under a paragraph here is the line of
 * algebra it produces, which then reads as belonging to nothing. A count that
 * runs short is worse: it loses the end of the sentence, which is where the
 * point usually is. Neither is a thing to guess at when the browser doing the
 * wrapping is right there.
 */
function textHeight(text: string, width: number, size: keyof typeof TYPE) {
  const point = TYPE[size]
  const lines = wrappedLines(text, width - TEXT_PAD, point) ?? estimatedLines(text, width, point)
  // A little over the rendered height, so a wrap that lands a hair differently
  // is not a clipped descender.
  return lines * point * LEADING + 2
}

/**
 * How many lines this is, as the browser will actually break it.
 *
 * Null when there is nothing to ask — the server, or a page whose hand font has
 * not arrived yet. Measuring against a fallback face and then re-rendering in
 * the real one is how a paragraph ends up half a line too tall for its box.
 */
function wrappedLines(text: string, width: number, point: number): number | null {
  if (typeof document === 'undefined') return null

  // The same stack Shape.tsx sets, and the same face it will actually use —
  // next/font's variable is the real family followed by a metric-matched local
  // fallback, and it is the first of those the words are set in.
  const stack = getComputedStyle(document.documentElement).getPropertyValue('--font-hand').trim()
  const hand = stack.split(',')[0]?.trim()
  if (!hand) return null

  const context = (ruler ??= document.createElement('canvas')).getContext('2d')
  if (!context) return null

  try {
    if (!document.fonts?.check(`${point}px ${hand}`)) return null
    context.font = `${point}px ${stack}, ui-rounded, "Comic Sans MS", cursive`
  } catch {
    // A font stack this cannot parse. `check` throws on one; the canvas keeps
    // its last font and would measure in something else entirely.
    return null
  }
  // Assigning a font the canvas will not parse is silently ignored, and the
  // 10px sans-serif left behind measures every paragraph as one short line.
  if (!context.font.includes(`${point}px`)) return null

  let lines = 0
  for (const paragraph of text.split('\n')) {
    lines += 1
    let run = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = run ? `${run} ${word}` : word
      if (run && context.measureText(next).width > width) {
        lines += 1
        run = word
      } else {
        run = next
      }
    }
  }
  return lines
}

/** Where the ruler is kept, so a page of steps is not a page of canvases. */
let ruler: HTMLCanvasElement | null = null

/**
 * The fallback, deliberately generous.
 *
 * `CHAR` is wider than the hand font really is, because a box that runs short
 * loses the end of a sentence and one that runs long costs white space.
 */
const CHAR = 0.55

function estimatedLines(text: string, width: number, point: number) {
  const perLine = Math.max(6, Math.floor((width - 40) / (point * CHAR)))
  return text
    .split('\n')
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / perLine)), 0)
}

/**
 * Lays a solution out as one column, top to bottom.
 *
 * A column and not a two-sided tree: mathematics is read in order, each line
 * following from the one above it, and the moment two steps sit side by side
 * the reader has to work out which came first.
 *
 * Nothing in the column is titled. It is one continuous piece of working —
 * sentence, line, sentence, line — the way it would be written on paper.
 */
export function solutionToScene(solution: MathSolution, id = 'math'): Scene | null {
  const steps = solution.steps.filter((step) => step.say.trim() || step.math.trim())
  if (!solution.title.trim() && !steps.length) return null

  const shapes: BoardShape[] = []
  const x = COL_X
  let y = MARGIN

  const titleH = Math.max(TITLE_H, textHeight(solution.title, COL_W, 'l'))
  shapes.push({
    ...base(),
    id: 'title',
    kind: 'text',
    text: solution.title,
    x,
    y,
    w: COL_W,
    h: titleH,
    size: 'l',
  })
  y += titleH + 16

  if (solution.given.trim()) {
    shapes.push({
      ...base(),
      id: 'given',
      kind: 'math',
      text: solution.given,
      x,
      y,
      w: COL_W,
      h: Math.max(GIVEN_H, mathHeight(solution.given) + 24),
      color: 'black',
      fill: 'semi',
    })
    y += Math.max(GIVEN_H, mathHeight(solution.given) + 24) + STEP_GAP
  }

  // Every shape of a step is named after the step — `s2`, `s2.m`, `s2.p` — so
  // the camera can be pointed at "step two" and get the sentence, the line of
  // algebra and the graph together.
  for (const [i, step] of steps.entries()) {
    const bodyH = step.say.trim() ? textHeight(step.say, COL_W, 's') : 0

    if (bodyH) {
      shapes.push({
        ...base(),
        id: `s${i}`,
        kind: 'note',
        text: step.say,
        x,
        y,
        w: COL_W,
        h: bodyH,
        color: 'black',
        size: 's',
      })
      y += bodyH + SAY_GAP
    }

    if (step.math.trim()) {
      const h = mathHeight(step.math)
      shapes.push({
        ...base(),
        id: `s${i}.m`,
        kind: 'math',
        text: step.math,
        x,
        y,
        w: COL_W,
        h,
        color: LIMB_COLORS[i % LIMB_COLORS.length],
      })
      y += h
    }

    // The graph, when the step has one and it can actually be drawn. A spec
    // this cannot sample produces nothing rather than an empty frame.
    const drawn = step.plot ? drawing(step.plot) : null
    if (drawn) {
      shapes.push({
        ...base(),
        id: `s${i}.p`,
        kind: 'plot',
        // Serialised, the way a math shape carries its LaTeX: the layout has
        // done the sampling, and the renderer only has to draw.
        text: JSON.stringify(drawn),
        x,
        y: y + 8,
        w: PLOT_W,
        h: PLOT_H,
        color: LIMB_COLORS[i % LIMB_COLORS.length],
      })
      y += PLOT_H + 16
    }

    y += STEP_GAP
  }

  if (solution.answer.trim()) {
    shapes.push({
      ...base(),
      id: 'answer',
      kind: 'math',
      text: solution.answer,
      x,
      y,
      w: COL_W,
      h: Math.max(ANSWER_H, mathHeight(solution.answer) + 24),
      color: 'green',
      fill: 'semi',
    })
    y += Math.max(ANSWER_H, mathHeight(solution.answer) + 24) + 12

    if (solution.answerNote.trim()) {
      const h = textHeight(solution.answerNote, COL_W, 's') + 12
      shapes.push({
        ...base(),
        id: 'answer-note',
        kind: 'text',
        text: solution.answerNote,
        x,
        y,
        w: COL_W,
        h,
        color: 'grey',
        size: 's',
      })
      y += h + STEP_GAP
    }
  }

  if (solution.check.trim()) {
    // Unlabelled, like every other paragraph here. "Check" over two sentences
    // of arithmetic announces what the sentences say themselves — and a
    // labelled block at the foot of the page turns the working into a form.
    const h = textHeight(solution.check, COL_W, 's') + 8
    shapes.push({
      ...base(),
      id: 'check',
      kind: 'note',
      text: solution.check,
      x,
      y,
      w: COL_W,
      h,
      color: 'grey',
      size: 's',
    })
  }

  return {
    id,
    heading: solution.title,
    // Silent, like a map: this is read, not played.
    narration: '',
    diagram: { source: '', timing: [] },
    layout: 'fixed',
    shapes,
  }
}

/** One colour per step, so a long solution has landmarks in it. */
const LIMB_COLORS = ['blue', 'violet', 'green', 'orange'] as const

function base(): BoardShape {
  return {
    id: '',
    kind: 'text',
    text: '',
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    from: null,
    to: null,
    color: 'black',
    fill: 'none',
    size: 'm',
    dash: 'draw',
    at: 0,
    anchor: '',
    points: [],
    data: [],
    parent: null,
  }
}

/* --------------------------------------------------------------- schemas --- */

export const MATH_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'given', 'givenSpoken', 'steps', 'answer', 'answerSpoken', 'answerNote', 'check'],
  properties: {
    title: { type: 'string' },
    given: { type: 'string' },
    givenSpoken: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['say', 'math', 'spoken', 'plot'],
        properties: {
          say: { type: 'string' },
          math: { type: 'string' },
          spoken: { type: 'string' },
          plot: {
            type: ['object', 'null'],
            additionalProperties: false,
            required: ['functions', 'xMin', 'xMax', 'marks', 'caption'],
            properties: {
              functions: { type: 'array', items: { type: 'string' } },
              xMin: { type: 'number' },
              xMax: { type: 'number' },
              marks: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['x', 'y', 'label'],
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    label: { type: 'string' },
                  },
                },
              },
              caption: { type: 'string' },
            },
          },
        },
      },
    },
    answer: { type: 'string' },
    answerSpoken: { type: 'string' },
    answerNote: { type: 'string' },
    check: { type: 'string' },
  },
} as const

/** The model's answer, trimmed to what the board can hold. */
export function solutionFromModel(raw: unknown): MathSolution | null {
  const value = raw as Partial<Record<keyof MathSolution, unknown>>
  const text = (input: unknown, limit: number) =>
    typeof input === 'string' ? input.trim().slice(0, limit) : ''

  const steps = (Array.isArray(value.steps) ? value.steps : [])
    .slice(0, 14)
    .map((step) => {
      const entry = step as Partial<Record<keyof MathStep, unknown>>
      return {
        say: text(entry.say, 400),
        math: text(entry.math, 400),
        spoken: text(entry.spoken, 400),
        plot: plotOf(entry.plot),
      }
    })
    .filter((step) => step.say || step.math)

  const title = text(value.title, 120)
  if (!title && !steps.length) return null

  return {
    title: title || 'Worked solution',
    given: text(value.given, 400),
    givenSpoken: text(value.givenSpoken, 400),
    steps,
    answer: text(value.answer, 300),
    answerSpoken: text(value.answerSpoken, 300),
    answerNote: text(value.answerNote, 300),
    check: text(value.check, 400),
  }
}

/** A plot spec from the model, or null when there is nothing drawable in it. */
function plotOf(raw: unknown): PlotSpec | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<Record<keyof PlotSpec, unknown>>

  const functions = (Array.isArray(value.functions) ? value.functions : [])
    .filter((fn): fn is string => typeof fn === 'string' && Boolean(fn.trim()))
    .slice(0, 3)
  if (!functions.length) return null

  const number = (input: unknown, fallback: number) =>
    typeof input === 'number' && Number.isFinite(input) ? input : fallback

  return {
    functions,
    xMin: number(value.xMin, -5),
    xMax: number(value.xMax, 5),
    marks: (Array.isArray(value.marks) ? value.marks : [])
      .slice(0, 6)
      .map((mark) => {
        const entry = mark as { x?: unknown; y?: unknown; label?: unknown }
        return {
          x: number(entry.x, Number.NaN),
          y: number(entry.y, Number.NaN),
          label: typeof entry.label === 'string' ? entry.label.slice(0, 40) : '',
        }
      })
      .filter((mark) => Number.isFinite(mark.x) && Number.isFinite(mark.y)),
    caption: typeof value.caption === 'string' ? value.caption.slice(0, 120) : '',
  }
}

/* ---------------------------------------------------------------- speech --- */

/**
 * Notation, said out loud.
 *
 * A safety net, not the plan. The model is asked to write the spoken form
 * itself, because it knows that "\\frac{dy}{dx}" is "dee y by dee x" and no
 * table of rules ever will. But one stray symbol reaching the speech engine
 * comes back as "two x caret two", and a tutor that mispronounces the problem
 * is worse than one that says nothing — so anything still carrying notation is
 * put through this before it is spoken.
 */
export function speakable(text: string) {
  let said = text

  // Innermost first, and repeatedly: a fraction whose numerator contains a
  // root has nested braces, and one pass over it leaves the word "frac"
  // sitting in the sentence.
  for (let pass = 0; pass < 4; pass++) {
    const before = said
    said = said.replace(/\\text\s*\{([^{}]*)\}/g, ' $1 ')
    said = said.replace(/\\sqrt\s*\[3\]\s*\{([^{}]*)\}/g, ' the cube root of $1 ')
    said = said.replace(/\\sqrt\s*\{([^{}]*)\}/g, ' the square root of $1 ')
    said = said.replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, ' $1 over $2 ')
    if (said === before) break
  }
  // Anything still carrying the macro had braces this could not pair up.
  said = said.replace(/\\d?frac/g, ' over ')
  said = said.replace(/\^\s*\{?2\}?/g, ' squared ')
  said = said.replace(/\^\s*\{?3\}?/g, ' cubed ')
  said = said.replace(/\^\s*\{([^{}]*)\}/g, ' to the power $1 ')
  said = said.replace(/\^\s*(\w)/g, ' to the power $1 ')
  said = said.replace(/_\s*\{([^{}]*)\}/g, ' sub $1 ')
  said = said.replace(/_\s*(\w)/g, ' sub $1 ')

  for (const [pattern, word] of WORDS) said = said.replace(pattern, word)

  // Implicit multiplication: "2x" is "two x", and the speech engine will not
  // work that out on its own.
  said = said.replace(/(\d)\s*([a-zA-Z])\b/g, '$1 $2')

  return said
    .replace(/[{}$\\]/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Symbol to word. Longest first, so `\leq` never matches as `<` plus junk. */
const WORDS: [RegExp, string][] = [
  [/\\left|\\right|\\quad|\\qquad|\\,|\\;|\\!/g, ' '],
  [/\\times/g, ' times '],
  [/\\cdot/g, ' times '],
  [/\\div/g, ' divided by '],
  [/\\pm/g, ' plus or minus '],
  [/\\mp/g, ' minus or plus '],
  [/\\leq|\\le\b|<=/g, ' is less than or equal to '],
  [/\\geq|\\ge\b|>=/g, ' is greater than or equal to '],
  [/\\neq|\\ne\b|!=/g, ' is not equal to '],
  [/\\approx/g, ' is approximately '],
  [/\\infty/g, ' infinity '],
  [/\\pi\b/g, ' pi '],
  [/\\theta\b/g, ' theta '],
  [/\\alpha\b/g, ' alpha '],
  [/\\beta\b/g, ' beta '],
  [/\\lambda\b/g, ' lambda '],
  [/\\Delta|\\delta\b/g, ' delta '],
  [/\\sum\b/g, ' the sum of '],
  [/\\prod\b/g, ' the product of '],
  [/\\int\b/g, ' the integral of '],
  [/\\lim\b/g, ' the limit of '],
  [/\\ln\b/g, ' the natural log of '],
  [/\\log\b/g, ' log '],
  [/\\sin\b/g, ' sine '],
  [/\\cos\b/g, ' cosine '],
  [/\\tan\b/g, ' tangent '],
  [/\\in\b/g, ' in '],
  [/\\rightarrow|\\to\b|->/g, ' goes to '],
  [/\\implies|=>/g, ' therefore '],
  [/=/g, ' equals '],
  [/\+/g, ' plus '],
  [/(?<=[\w)\s])-(?=[\w(\s])/g, ' minus '],
  [/</g, ' is less than '],
  [/>/g, ' is greater than '],
]
