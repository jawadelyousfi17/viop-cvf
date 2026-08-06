import { SCENE_W, type BoardShape, type Lesson, type Scene, type ShapeKind } from './lesson'

/**
 * Chalk — a small language for boards.
 *
 * The board's JSON is a fine thing for a program to read and an expensive
 * thing for a model to write. Every shape repeats twenty key names it did not
 * choose, so a dense scene costs around a thousand tokens of mostly
 * punctuation, and the interesting part — what is drawn, and on which words —
 * is buried in it.
 *
 * Chalk is the same board, written the way you would say it. One shape a line,
 * no coordinates at all, and the two things that actually matter given their
 * own single characters: `@` for colour and `|` for the words a shape lands
 * on.
 *
 *     = Why your CPU has a cache
 *     : Memory is slow, so the CPU keeps a copy of what it just touched.
 *
 *     ---
 *     say Your processor does something every third of a nanosecond. Main
 *     say memory takes about a hundred nanoseconds to answer.
 *
 *     box #cpu PROCESSOR / 0.3 ns per step @blue | processor does something
 *     box #ram MAIN MEMORY / 100 ns per fetch @yellow | hundred nanoseconds
 *     -> cpu ram : one value / three hundred steps wasted | three hundred
 *
 *     bar nanoseconds to answer @blue = step 0.3, L1 1, memory 100 | It is waiting
 *     num 300× @red | three hundred more steps
 *
 * Three rules carry it. A blank line ends a row, so grouping is expressed by
 * how the text is laid out rather than by numbers. Kinds are three letters,
 * because a model writing `box` two hundred times should not pay for
 * `"kind": "box"` each time. And anything not said takes a sensible default,
 * so a line is as short as the thing it describes.
 */

/** The short kind names, and what they mean on the board. */
const KINDS: Record<string, ShapeKind> = {
  box: 'box',
  oval: 'oval',
  ell: 'ellipse',
  dia: 'diamond',
  hex: 'hexagon',
  star: 'star',
  cloud: 'cloud',
  lab: 'label',
  txt: 'text',
  // A number or formula, set large. Its own word because a board is mostly
  // numbers and `txt ... @size=xl` would be three tokens to say so.
  num: 'text',
  note: 'note',
  img: 'image',
  sym: 'symbol',
  ico: 'icon',
  tbl: 'table',
  arr: 'array',
  stk: 'stack',
  bar: 'barchart',
  plot: 'linechart',
  pie: 'piechart',
  ring: 'ring',
  hl: 'highlight',
}

/** Colour words, expanded to the board's palette. */
const COLOURS: Record<string, BoardShape['color']> = {
  blue: 'light-blue',
  green: 'light-green',
  red: 'light-red',
  violet: 'light-violet',
  yellow: 'yellow',
  orange: 'orange',
  grey: 'grey',
  black: 'black',
}

/** Kinds that are containers, and so take a tint rather than just a colour. */
const CONTAINERS = new Set<ShapeKind>([
  'box',
  'oval',
  'ellipse',
  'diamond',
  'hexagon',
  'star',
  'cloud',
])

/** Roughly what each kind wants, before the layout pass has its say. */
const SIZES: Partial<Record<ShapeKind, { w: number; h: number }>> = {
  image: { w: 560, h: 300 },
  symbol: { w: 170, h: 170 },
  icon: { w: 120, h: 120 },
  note: { w: 200, h: 200 },
  table: { w: 760, h: 240 },
  array: { w: 900, h: 130 },
  stack: { w: 700, h: 420 },
  barchart: { w: 700, h: 400 },
  linechart: { w: 760, h: 420 },
  piechart: { w: 560, h: 400 },
  label: { w: 420, h: 76 },
  text: { w: 420, h: 70 },
}

export interface ChalkError {
  line: number
  message: string
}

export interface ChalkResult {
  lesson: Lesson
  errors: ChalkError[]
}

export interface ChalkOptions {
  /**
   * The narration for each scene, when it is already known.
   *
   * Drawing a written script used to mean asking the model to copy that script
   * back to us — thirty per cent of everything it wrote, and the only reason
   * the narration could come back altered at all. Supplied here instead, a
   * scene's words are right by construction and cost nothing to produce.
   */
  narration?: string[]
}

interface Pending {
  shape: BoardShape
  row: number
}

/**
 * Splits `text @blue = a 1, b 2 | anchor` into its parts.
 *
 * Each separator is deliberately narrow about when it counts, because the
 * alternative is a language that quietly eats content. `=` is only data on a
 * chart, so a formula can say `z = Wx + b`. `@` is only a colour when it names
 * one, so an address survives. `|` is the last one on the line, so a table's
 * own columns are not mistaken for an anchor.
 */
function split(rest: string, kind: ShapeKind) {
  let text = rest
  let anchor = ''
  let colour = ''
  let data = ''

  // Anchors sit at the end, and cells are written with commas, so the last
  // pipe is the separator even when the text contains others.
  const bar = text.lastIndexOf('|')
  if (bar !== -1) {
    anchor = text.slice(bar + 1).trim()
    text = text.slice(0, bar)
  }

  if (CHARTS.has(kind)) {
    const equals = text.indexOf('=')
    if (equals !== -1) {
      data = text.slice(equals + 1).trim()
      text = text.slice(0, equals)
    }
  }

  text = text.replace(/@([a-z-]+)/i, (whole, name) => {
    const found = String(name).toLowerCase()
    if (!(found in COLOURS)) return whole
    colour = found
    return ''
  })

  return { text: text.trim(), anchor, colour, data }
}

/** Kinds that read `= label value, ...` as their numbers. */
const CHARTS = new Set<ShapeKind>(['barchart', 'linechart', 'piechart'])

/** Kinds built from cells: commas are columns, ` / ` is a new row. */
const CELLED = new Set<ShapeKind>(['table', 'array'])

/** `one 3, two 7` — a label and a number per entry. */
function parseData(source: string) {
  return source
    .split(',')
    .map((entry) => {
      const trimmed = entry.trim()
      const at = trimmed.lastIndexOf(' ')
      if (at === -1) return null
      const value = Number(trimmed.slice(at + 1))
      return Number.isFinite(value) ? { label: trimmed.slice(0, at).trim(), value } : null
    })
    .filter((point): point is { label: string; value: number } => point !== null)
}

function blank(id: string, kind: ShapeKind): BoardShape {
  const size = SIZES[kind] ?? { w: 320, h: 130 }
  return {
    id,
    kind,
    text: '',
    x: 0,
    y: 0,
    w: size.w,
    h: size.h,
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
  }
}

/**
 * Compiles Chalk into a lesson.
 *
 * Forgiving on purpose: an unknown kind or a dangling arrow is reported and
 * skipped rather than failing the document. A model that gets one line wrong
 * should lose one shape, not the lesson.
 */
export function compileChalk(source: string, options: ChalkOptions = {}): ChalkResult {
  const errors: ChalkError[] = []
  const scenes: Scene[] = []

  let title = ''
  let summary = ''

  let narration: string[] = []
  let pending: Pending[] = []
  let flow: string[] = []
  let row = 0
  let inFlow = false
  let started = false

  const flush = () => {
    if (!started) return
    // Whatever the model wrote wins; otherwise the script's own words, which
    // is the usual case and the cheap one.
    const written = narration.join(' ').trim()
    const supplied = options.narration?.[scenes.length]?.trim() ?? ''
    scenes.push(finishScene(scenes.length, written || supplied, pending, flow.join('\n')))
    narration = []
    pending = []
    flow = []
    row = 0
  }

  const lines = source.replace(/\r\n?/g, '\n').split('\n')

  for (const [index, raw] of lines.entries()) {
    const line = raw.trim()
    const number = index + 1

    // Inside a flowchart, indentation is the block and a blank line ends it.
    if (inFlow) {
      if (!line) inFlow = false
      else flow.push(line)
      continue
    }

    if (!line) {
      // A blank line ends the row. Only counts once, so extra spacing is free.
      if (pending.some((item) => item.row === row)) row++
      continue
    }

    if (line.startsWith('=')) {
      title = line.slice(1).trim()
      continue
    }
    if (line.startsWith(':')) {
      summary = line.slice(1).trim()
      continue
    }
    if (/^-{3,}$/.test(line)) {
      flush()
      started = true
      continue
    }

    const space = line.indexOf(' ')
    const head = (space === -1 ? line : line.slice(0, space)).toLowerCase()
    const rest = space === -1 ? '' : line.slice(space + 1)

    if (head === 'say') {
      started = true
      // `say ^` means "the words I was given for this scene". Writing them out
      // again would only be a chance to get them wrong.
      if (rest.trim() !== '^') narration.push(rest.trim())
      continue
    }

    if (head === 'flow') {
      started = true
      inFlow = true
      continue
    }

    if (head === '->') {
      started = true
      const arrow = parseArrow(rest, pending.length)
      if (!arrow) {
        errors.push({ line: number, message: 'An arrow needs two ids: -> from to : label' })
        continue
      }
      // Arrows follow their ends, so they never claim a row of their own.
      pending.push({ shape: arrow, row })
      continue
    }

    const kind = KINDS[head]
    if (!kind) {
      errors.push({ line: number, message: `Unknown kind "${head}".` })
      continue
    }
    started = true

    // `#name` gives the shape an id an arrow can point at.
    let body = rest
    let id = `s${pending.length + 1}`
    const named = /^#([\w-]+)\s*/.exec(body)
    if (named) {
      id = named[1]
      body = body.slice(named[0].length)
    }

    const parts = split(body, kind)
    const shape = blank(id, kind)
    shape.text = parts.text.replace(/\s+\/\s+/g, '\n')
    // Cells are written with commas and drawn with pipes. The board's own
    // format uses pipes, which is exactly the character an anchor is marked
    // with — so the two never meet in what someone actually types.
    if (CELLED.has(kind)) {
      shape.text = shape.text
        .split('\n')
        .map((row) => row.split(',').map((cell) => cell.trim()).join('|'))
        .join('\n')
    }
    shape.anchor = parts.anchor

    if (parts.colour) {
      const colour = COLOURS[parts.colour]
      if (!colour) errors.push({ line: number, message: `Unknown colour "${parts.colour}".` })
      else {
        shape.color = colour
        // A container with a colour is tinted; lettering just takes the ink.
        if (CONTAINERS.has(kind)) shape.fill = 'semi'
      }
    }

    if (parts.data) shape.data = parseData(parts.data)
    if (head === 'num') shape.size = 'xl'
    if (head === 'lab') shape.size = 'l'
    if (kind === 'note' && shape.color === 'black') shape.color = 'yellow'

    // A ring or a highlight is drawn over what came before it, which is what
    // makes them worth one word: nothing else needs saying.
    if (kind === 'ring' || kind === 'highlight') {
      const previous = [...pending].reverse().find((item) => item.shape.kind !== 'arrow')
      if (previous) {
        shape.x = previous.shape.x
        shape.y = previous.shape.y
        shape.w = previous.shape.w
        shape.h = previous.shape.h
        if (kind === 'highlight') {
          shape.points = [
            { x: previous.shape.x, y: previous.shape.y + previous.shape.h / 2 },
            { x: previous.shape.x + previous.shape.w, y: previous.shape.y + previous.shape.h / 2 },
          ]
        }
        if (!shape.anchor) shape.anchor = previous.shape.anchor
      }
      pending.push({ shape, row })
      continue
    }

    pending.push({ shape, row })
  }

  flush()

  return {
    lesson: {
      title,
      summary,
      scenes: scenes.filter((scene) => scene.narration.trim()),
    },
    errors,
  }
}

/**
 * Works out when each shape appears.
 *
 * A shape that named its words is placed where those words fall in the
 * narration — which is a far better guess than its position in the list, and
 * is what the voice will do to it anyway once there is alignment to read.
 *
 * Everything else is spread between its anchored neighbours rather than across
 * the whole scene. That is what makes an anchor optional: a shape written
 * between two anchored ones lands between them, so only every second or third
 * line needs to name its phrase, and the rest are free.
 */
function timeShapes(shapes: BoardShape[], narration: string) {
  const haystack = narration.toLowerCase()
  const length = Math.max(1, haystack.length)

  // Where each anchored shape falls, as a fraction of the narration.
  const known = new Map<number, number>()
  for (const [i, shape] of shapes.entries()) {
    if (!shape.anchor) continue
    const at = haystack.indexOf(shape.anchor.trim().toLowerCase())
    if (at !== -1) known.set(i, Math.min(0.95, at / length))
  }

  if (!known.size) {
    for (const [i, shape] of shapes.entries()) {
      shape.at = shapes.length > 1 ? Math.min(0.95, i / shapes.length) : 0
    }
    return
  }

  const marks = [...known.keys()].sort((a, b) => a - b)
  for (const [i, shape] of shapes.entries()) {
    const exact = known.get(i)
    if (exact !== undefined) {
      shape.at = exact
      continue
    }

    // The nearest anchored shape on each side, and how far between them this
    // one sits.
    const after = marks.find((mark) => mark > i)
    const before = [...marks].reverse().find((mark) => mark < i)

    const from = before === undefined ? 0 : known.get(before)!
    const to = after === undefined ? 0.95 : known.get(after)!
    const span = (after ?? shapes.length) - (before ?? -1)
    const step = i - (before ?? -1)
    shape.at = Math.min(0.95, from + ((to - from) * step) / Math.max(1, span))
  }
}

/** `-> from to : label | anchor` */
function parseArrow(rest: string, index: number): BoardShape | null {
  let body = rest
  let anchor = ''
  let label = ''

  const bar = body.indexOf('|')
  if (bar !== -1) {
    anchor = body.slice(bar + 1).trim()
    body = body.slice(0, bar)
  }
  const colon = body.indexOf(':')
  if (colon !== -1) {
    label = body.slice(colon + 1).trim()
    body = body.slice(0, colon)
  }

  const [from, to] = body.trim().split(/\s+/)
  if (!from || !to) return null

  const shape = blank(`a${index + 1}`, 'arrow')
  shape.from = from
  shape.to = to
  shape.text = label.replace(/\s+\/\s+/g, '\n')
  shape.anchor = anchor
  shape.w = 200
  shape.h = 0
  return shape
}

/**
 * Places one scene's shapes and times them.
 *
 * Coordinates here are only a sketch: rows go down the board and items spread
 * across, and the real layout pass reads that grouping and does the work. What
 * matters is that shapes written together stay together.
 *
 * Timing is spread evenly across the narration, which is the fallback anyway —
 * every shape that named its words is placed by those instead.
 */
function finishScene(index: number, narration: string, pending: Pending[], flow: string): Scene {
  const rows = new Map<number, Pending[]>()
  for (const item of pending) {
    if (item.shape.kind === 'arrow') continue
    const list = rows.get(item.row) ?? []
    list.push(item)
    rows.set(item.row, list)
  }

  const margin = 60
  const available = SCENE_W - margin * 2

  for (const [order, items] of [...rows.entries()].sort((a, b) => a[0] - b[0]).entries()) {
    const [, list] = items
    const total = list.reduce((sum, item) => sum + item.shape.w, 0)
    const gap = list.length > 1 ? Math.max(40, (available - total) / (list.length - 1)) : 0
    let x = margin + Math.max(0, (available - total - gap * (list.length - 1)) / 2)

    for (const item of list) {
      // Rings and highlights were already put over their target.
      if (item.shape.kind !== 'ring' && item.shape.kind !== 'highlight') {
        item.shape.x = x
        item.shape.y = 80 + order * 240
        x += item.shape.w + gap
      }
    }
  }

  timeShapes(pending.map((item) => item.shape), narration)

  return {
    id: `scene-${index + 1}`,
    heading: '',
    narration,
    diagram: flow.trim() ? { source: flow, timing: [] } : { source: '', timing: [] },
    shapes: pending.map((item) => item.shape),
  }
}
