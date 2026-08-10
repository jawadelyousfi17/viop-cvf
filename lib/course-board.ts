/**
 * The teacher's side of the whiteboard.
 *
 * A course section can carry a diagram that assembles itself as the narration
 * reaches each part of it. The author says what the parts *are* and *when* they
 * arrive; where they go is worked out here. There is no way to write an x, a y,
 * a width or a coordinate, and there will not be one — the same rule
 * `docs/slate.md` holds to, for the same reason: a board whose positions are
 * hand-placed stops being editable the moment a sentence is added.
 *
 *     ```draw |2
 *     title A variable is a label
 *     box #name myName |2
 *     box #value 'Beau' ~accent |3
 *     link name value : points at |4
 *     note The name is not the value |5
 *     ```
 *
 * **Everything is positioned up front, and only revealed on its beat.** The
 * layout is computed once from the whole block, so a box arriving at beat five
 * does not push the boxes already on the board sideways. A diagram that
 * reflows while someone is looking at it is a diagram they have to re-read.
 */

/**
 * The vocabulary.
 *
 * Five of these draw a *particular* idea rather than a generic rectangle, which
 * is the lesson `components/demos/` teaches: a diagram made only of boxes and
 * arrows makes every idea look like every other idea. A decision should look
 * like a fork. A list should look like indexed cells. An object should look
 * like a table of pairs. A sequence should look like a sequence.
 */
export type BoardKind =
  | 'title'
  | 'box'
  | 'cells'
  | 'link'
  | 'note'
  /** A sequence: steps left to right, connectors drawn for you. */
  | 'flow'
  /** A decision: the condition on top, its two outcomes below it. */
  | 'branch'
  /** An object: key and value, a pair to a row. */
  | 'pairs'

/** Meaning, not colour. Mapped to tldraw's palette by the painter. */
export type BoardTone = 'plain' | 'accent' | 'good' | 'warn' | 'muted'

const TONES: readonly BoardTone[] = ['plain', 'accent', 'good', 'warn', 'muted']

export interface BoardItem {
  kind: BoardKind
  id: string | null
  text: string
  /** `cells`: the contents, left to right. Indices are drawn underneath. */
  cells?: string[]
  /** `link`: the ids of the two boxes it joins. */
  from?: string
  to?: string
  /** `flow`: the steps, left to right. */
  steps?: string[]
  /** `branch`: what happens when the condition holds, and when it does not. */
  yes?: string
  no?: string
  /** `pairs`: key and value, a pair to a row. */
  pairs?: [string, string][]
  tone: BoardTone
  beat: number
  /** Filled in by `layout`. Absent on a link, which binds to its two ends. */
  x?: number
  y?: number
  w?: number
  h?: number
  line: number
}

/**
 * The board's own coordinate space.
 *
 * Fixed, so a section's diagram is composed against the same rectangle every
 * time and the camera can frame it without measuring anything. The panel it is
 * shown in can be any size; tldraw scales.
 */
export const BOARD_W = 980
export const BOARD_H = 640

const BOX_W = 200
const BOX_H = 104

/**
 * Two gaps, and they are different sizes on purpose.
 *
 * The horizontal one has to hold an arrow's label. tldraw sizes a bound arrow's
 * label to the space between the shapes it joins, so a tight gap wraps "points
 * at" into a two-character column and the diagram becomes unreadable. The
 * vertical gap only has to separate rows, so it stays small.
 */
const H_GAP = 160
const V_GAP = 54

const PER_ROW = 3
const CELL = 74

/** A step in a `flow`, and the room an arrow needs between two of them. */
const FLOW_W = 150
const FLOW_H = 78
const FLOW_GAP = 66

/** A `branch`: the condition, then a drop, then the two arms side by side. */
const COND_W = 260
const COND_H = 80
const ARM_W = 210
const ARM_H = 72
const ARM_GAP = 110
const BRANCH_DROP = 76

/** A row of a `pairs` table. */
const PAIR_H = 56
const PAIR_W = 460

/** Splits on the first occurrence only, so a value may contain the separator. */
function splitOnce(text: string, separator: string): [string, string] {
  const at = text.indexOf(separator)
  return at === -1 ? [text, ''] : [text.slice(0, at), text.slice(at + separator.length)]
}

export interface BoardProblem {
  line: number
  message: string
}

/**
 * Parses one `draw` block. Never throws; a bad line is reported and dropped,
 * because one malformed arrow should cost one arrow and not the diagram.
 */
export function parseBoard(
  body: string[],
  defaultBeat: number,
  lastBeat: number,
  startLine: number
): { items: BoardItem[]; problems: BoardProblem[] } {
  const items: BoardItem[] = []
  const problems: BoardProblem[] = []

  body.forEach((raw, index) => {
    const line = startLine + index + 1
    let text = raw.trim()
    if (!text || text.startsWith('//')) return

    // Beat and tone are suffixes, pulled off before the kind is read so that a
    // `note` containing the word "accent" is still just a note.
    let beat = defaultBeat
    const beatMatch = /\s\|(\d+)$/.exec(text)
    if (beatMatch) {
      beat = Number(beatMatch[1])
      text = text.slice(0, beatMatch.index).trim()
    }

    let tone: BoardTone = 'plain'
    const toneMatch = /\s~([a-z]+)$/.exec(text)
    if (toneMatch) {
      if (!TONES.includes(toneMatch[1] as BoardTone)) {
        problems.push({ line, message: `\`~${toneMatch[1]}\` is not a tone.` })
      } else {
        tone = toneMatch[1] as BoardTone
      }
      text = text.slice(0, toneMatch.index).trim()
    }

    if (beat < 1 || beat > lastBeat) {
      problems.push({ line, message: `beat ${beat} is past the last beat (${lastBeat}).` })
      return
    }

    const space = text.indexOf(' ')
    const kind = (space === -1 ? text : text.slice(0, space)) as BoardKind
    let rest = space === -1 ? '' : text.slice(space + 1).trim()

    const base = { tone, beat, line, id: null as string | null }

    if (kind === 'title' || kind === 'note') {
      if (!rest) {
        problems.push({ line, message: `a \`${kind}\` with nothing to say.` })
        return
      }
      items.push({ ...base, kind, text: rest })
      return
    }

    if (kind === 'box') {
      let id: string | null = null
      const named = /^#([\w-]+)\s*/.exec(rest)
      if (named) {
        id = named[1]
        rest = rest.slice(named[0].length)
      }
      if (!rest.trim()) {
        problems.push({ line, message: 'a `box` with no label.' })
        return
      }
      items.push({ ...base, kind, id, text: rest.trim() })
      return
    }

    if (kind === 'cells') {
      const cells = rest.split(',').map((cell) => cell.trim())
      if (cells.length < 2) {
        problems.push({ line, message: '`cells` needs at least two, separated by commas.' })
        return
      }
      items.push({ ...base, kind, text: '', cells })
      return
    }

    if (kind === 'flow') {
      const steps = rest.split('>').map((step) => step.trim()).filter(Boolean)
      if (steps.length < 2) {
        problems.push({ line, message: '`flow` needs at least two steps, separated by `>`.' })
        return
      }
      items.push({ ...base, kind, text: '', steps })
      return
    }

    if (kind === 'branch') {
      const [condition, arms = ''] = splitOnce(rest, '?')
      const [yes, no] = splitOnce(arms, ':')
      if (!condition.trim() || !yes.trim() || !no.trim()) {
        problems.push({
          line,
          message: '`branch` reads `branch <condition> ? <when true> : <when false>`.',
        })
        return
      }
      items.push({ ...base, kind, text: condition.trim(), yes: yes.trim(), no: no.trim() })
      return
    }

    if (kind === 'pairs') {
      const pairs = rest
        .split(',')
        .map((pair) => splitOnce(pair, ':').map((part) => part.trim()) as [string, string])
        .filter(([key, value]) => key && value)
      if (!pairs.length) {
        problems.push({ line, message: '`pairs` reads `pairs key: value, key: value`.' })
        return
      }
      items.push({ ...base, kind, text: '', pairs })
      return
    }

    if (kind === 'link') {
      const [ends, label = ''] = rest.split(':')
      const [from, to] = ends.trim().split(/\s+/)
      if (!from || !to) {
        problems.push({ line, message: '`link` needs two box names.' })
        return
      }
      items.push({
        ...base,
        kind,
        text: label.trim(),
        from: from.replace(/^#/, ''),
        to: to.replace(/^#/, ''),
      })
      return
    }

    problems.push({ line, message: `\`${kind}\` is not something the board can draw.` })
  })

  // An arrow to a box that does not exist would silently draw from nowhere.
  const named = new Set(items.filter((item) => item.id).map((item) => item.id))
  for (const item of items) {
    if (item.kind !== 'link') continue
    for (const end of [item.from, item.to]) {
      if (!named.has(end!)) {
        problems.push({ line: item.line, message: `\`link\` points at #${end}, which is not a box.` })
      }
    }
  }

  return { items: layout(items), problems }
}

/**
 * Places everything, once, for the whole block.
 *
 * Rows top to bottom in the order written: the title, then boxes gathered three
 * to a row, then any strip of cells, then the notes at the foot. The whole
 * stack is centred vertically afterwards so a two-box diagram sits in the
 * middle of the board rather than clinging to its top edge.
 */
function layout(items: BoardItem[]): BoardItem[] {
  let y = 0
  const rowsOf = <T>(list: T[], per: number) =>
    list.reduce<T[][]>((rows, item, i) => {
      if (i % per === 0) rows.push([])
      rows[rows.length - 1].push(item)
      return rows
    }, [])

  for (const item of items.filter((i) => i.kind === 'title')) {
    item.x = 0
    item.y = y
    item.w = BOARD_W
    item.h = 52
    y += 52 + V_GAP
  }

  // Boxes keep their written order, which is the order the narration mentions
  // them — so reading the board left to right reads the explanation forwards.
  const boxes = items.filter((i) => i.kind === 'box')
  for (const row of rowsOf(boxes, PER_ROW)) {
    const width = row.length * BOX_W + (row.length - 1) * H_GAP
    let x = (BOARD_W - width) / 2
    for (const box of row) {
      box.x = x
      box.y = y
      box.w = BOX_W
      box.h = BOX_H
      x += BOX_W + H_GAP
    }
    y += BOX_H + V_GAP
  }

  // A sequence gets a band to itself. Steps shrink to fit rather than running
  // off the edge, because a flow of six is a legitimate thing to want to draw.
  for (const run of items.filter((i) => i.kind === 'flow')) {
    const count = run.steps!.length
    const step = Math.min(FLOW_W, (BOARD_W - 40 - (count - 1) * FLOW_GAP) / count)
    const width = count * step + (count - 1) * FLOW_GAP
    run.x = (BOARD_W - width) / 2
    run.y = y
    run.w = width
    run.h = FLOW_H
    y += FLOW_H + V_GAP
  }

  for (const fork of items.filter((i) => i.kind === 'branch')) {
    const width = Math.max(COND_W, 2 * ARM_W + ARM_GAP)
    fork.x = (BOARD_W - width) / 2
    fork.y = y
    fork.w = width
    fork.h = COND_H + BRANCH_DROP + ARM_H
    y += fork.h + V_GAP
  }

  for (const table of items.filter((i) => i.kind === 'pairs')) {
    table.x = (BOARD_W - PAIR_W) / 2
    table.y = y
    table.w = PAIR_W
    table.h = table.pairs!.length * PAIR_H
    y += table.h + V_GAP
  }

  for (const strip of items.filter((i) => i.kind === 'cells')) {
    const count = strip.cells!.length
    const width = count * CELL
    strip.x = (BOARD_W - width) / 2
    strip.y = y
    strip.w = width
    strip.h = CELL
    // Room for the index numbers written under each cell.
    y += CELL + 40 + V_GAP
  }

  for (const note of items.filter((i) => i.kind === 'note')) {
    note.x = 40
    note.y = y
    note.w = BOARD_W - 80
    note.h = 44
    y += 44 + 14
  }

  // Centre the finished stack, so short diagrams are not top-heavy.
  const shift = Math.max(0, (BOARD_H - y) / 2)
  if (shift) {
    for (const item of items) if (item.y != null) item.y += shift
  }

  return items
}
