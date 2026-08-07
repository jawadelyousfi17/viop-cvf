import {
  SCENE_W,
  type BoardColor,
  type BoardShape,
  type Lesson,
  type Scene,
  type ShapeKind,
} from './lesson'
import {
  LAYOUT_KINDS,
  allNodes,
  parseLesson,
  parseScript,
  splitCaption,
  splitTarget,
  type SlateNode,
  type SlateScene,
} from './slate'
import { lint } from './slate-lint'
import { looksLikeYaml, parseYamlLesson } from './slate-yaml'
import type { SlateProblem } from './slate'

/**
 * Slate, compiled onto the whiteboard.
 *
 * The board already has a language — BoardShape, laid out and painted by
 * lib/lesson.ts — so this is a translation, not a second renderer. What it
 * mostly does is turn Slate's two good ideas into the board's terms:
 *
 * **Beats become anchors that cannot be wrong.** A whiteboard shape lands on
 * its words by naming a phrase from the narration, and every anchor problem
 * this project has had came from that phrase being written rather than quoted —
 * a model paraphrasing, a human mistyping, and either way a silent fall back to
 * a guessed time. A Slate beat is a sentence index, so the anchor is *lifted
 * out of the narration by number*. It is verbatim by construction. Nothing can
 * paraphrase an integer.
 *
 * **Rows and layers get their own moment.** A `tbl` in Chalk was one shape on
 * one beat: six facts arriving while the voice was on the first. Slate gives
 * every row a beat, and the board has no way to express that — so a block whose
 * rows are separately timed is compiled into one shape per row, stacked, which
 * is the same picture and the right timing.
 *
 * **What the board cannot do, said plainly.** A whiteboard accumulates: ink
 * goes on and stays. So `hide` and `dim` are dropped rather than faked, and
 * `replace` and `transform` are compiled as the new reading arriving beside the
 * old with a dashed arrow between them — which is what a person at a real board
 * does when they cannot erase. The engine that can do all of it is Slate's own
 * renderer, `components/slate/draw.ts`; this one is the translation, and a
 * translation that quietly invents the missing tense is worse than one that
 * says "and then this became that".
 */

export interface SlateBoardResult {
  lesson: Lesson
  errors: SlateProblem[]
  warnings: SlateProblem[]
}

export interface SlateBoardOptions {
  /**
   * The narration for each scene, keyed by the scene number Slate uses.
   *
   * Supplied when the words are already written and recorded, which is the case
   * that matters: the board is the only thing missing, and the narration has to
   * come back byte for byte or the recording no longer fits it.
   */
  narration?: Map<number, string>
}

/** Slate's kinds, in the board's vocabulary. */
const KINDS: Record<string, ShapeKind> = {
  box: 'box',
  // A person or a system outside the boundary: rounded, so it reads as not one
  // of the parts.
  actor: 'oval',
  step: 'box',
  choice: 'diamond',
  branch: 'diamond',
  // A group is a boundary, drawn dashed below so it reads as belonging rather
  // than as another part.
  group: 'box',
  store: 'ellipse',
  stk: 'stack',
  arr: 'array',
  tbl: 'table',
  code: 'code',
  img: 'image',
  sym: 'symbol',
  ico: 'icon',
  label: 'label',
  lab: 'label',
  callout: 'text',
  txt: 'text',
  item: 'text',
}

const CHART_KIND: Record<string, ShapeKind> = {
  bar: 'barchart',
  pie: 'piechart',
  line: 'linechart',
}

const BOARD_COLORS: Record<string, BoardColor> = {
  blue: 'blue',
  green: 'green',
  red: 'red',
  violet: 'violet',
  yellow: 'yellow',
  orange: 'orange',
  grey: 'grey',
  black: 'black',
}

/** Roughly the room each kind wants before the layout pass rewrites it. */
const SIZE: Record<string, { w: number; h: number }> = {
  box: { w: 320, h: 130 },
  oval: { w: 320, h: 130 },
  diamond: { w: 300, h: 150 },
  ellipse: { w: 300, h: 140 },
  stack: { w: 420, h: 260 },
  array: { w: 620, h: 130 },
  table: { w: 640, h: 240 },
  code: { w: 560, h: 240 },
  image: { w: 460, h: 300 },
  symbol: { w: 170, h: 170 },
  icon: { w: 120, h: 120 },
  label: { w: 420, h: 76 },
  text: { w: 460, h: 70 },
  barchart: { w: 620, h: 400 },
  piechart: { w: 560, h: 400 },
  linechart: { w: 620, h: 400 },
  ring: { w: 320, h: 150 },
  highlight: { w: 320, h: 60 },
}

/** A morph, in the shape `emit` wants. Only the four fields it reads matter. */
function asNode(source: {
  text: string
  stat: string | null
  role: string | null
  beat: number
}): SlateNode {
  return {
    kind: 'box',
    name: null,
    text: source.text,
    stat: source.stat,
    role: source.role,
    colour: null,
    layout: null,
    beatTok: null,
    beat: source.beat,
    beatEnd: 0,
    shared: false,
    held: false,
    children: [],
    rows: [],
    arms: [],
    line: 0,
  }
}

/** Enough of a sentence to be found in the alignment, short enough to be exact. */
export function openingWords(sentence: string, words = 6) {
  return sentence.trim().split(/\s+/).slice(0, words).join(' ')
}

export function compileSlate(source: string, options: SlateBoardOptions = {}): SlateBoardResult {
  // When the narration is already written, Slate's scene numbers index into it,
  // so a document can draw scenes seven to nine of a fifteen-scene script.
  const script = new Map<number, string[]>()
  for (const [n, text] of options.narration ?? []) {
    script.set(n, parseScript(text).get(1) ?? [])
  }

  // Either front end. They build the same board, so the only thing the choice
  // can break is the parse — and that is decidable from the first line.
  const parsed = looksLikeYaml(source)
    ? parseYamlLesson(source, script)
    : parseLesson(source, script)
  const problems = lint(parsed)

  const scenes: Scene[] = parsed.scenes.map((scene) => compileScene(parsed.roles, scene))

  return {
    lesson: {
      title: parsed.title || 'Untitled',
      summary: parsed.sub,
      scenes: scenes.filter((scene) => scene.narration.trim()),
    },
    errors: problems.filter((problem) => problem.level === 'err'),
    warnings: problems.filter((problem) => problem.level === 'warn'),
  }
}

function compileScene(roles: Record<string, string>, scene: SlateScene): Scene {
  const shapes: BoardShape[] = []
  const beats = scene.beats
  const total = Math.max(1, beats.length)

  /** A beat, as the board understands time. */
  const timing = (beat: number) => ({
    // Copied out of the narration by number, so it is verbatim or it is nothing.
    anchor: beat > 0 && beats[beat - 1] ? openingWords(beats[beat - 1]) : '',
    at: Math.min(0.95, Math.max(0, (beat - 1) / total)),
  })

  const colourOf = (node: SlateNode): BoardColor => {
    const named = node.colour || (node.role ? roles[node.role] : null)
    return (named && BOARD_COLORS[named]) || 'black'
  }

  /** Slate's ` / ` line break and its `[stat]` are both the board's two tiers. */
  const textOf = (node: SlateNode) => {
    const lines = node.text ? node.text.split(' / ') : []
    if (node.stat) lines.push(node.stat)
    return lines.join('\n')
  }

  let taken = 0
  const place = (kind: ShapeKind) => {
    const size = SIZE[kind] ?? SIZE.box
    // A sketch only. flowTopToBottom re-flows all of it; what matters is which
    // shapes share a y, because that is what it reads as "side by side".
    const x = 60 + (taken % 3) * 560
    const y = 80 + Math.floor(taken / 3) * 240
    taken++
    return { x, y, w: size.w, h: size.h }
  }

  const emit = (node: SlateNode, kind: ShapeKind, extra: Partial<BoardShape> = {}) => {
    const beat = timing(node.beat)
    const shape: BoardShape = {
      id: node.name || `s${shapes.length}`,
      kind,
      text: textOf(node),
      ...place(kind),
      from: null,
      to: null,
      parent: null,
      color: colourOf(node),
      fill: 'none',
      size: 'm',
      dash: 'draw',
      at: beat.at,
      anchor: beat.anchor,
      points: [],
      data: [],
      ...extra,
    }
    shapes.push(shape)
    return shape
  }

  /** An arrow between two shapes that already exist. */
  const link = (
    from: string,
    to: string,
    text: string,
    beat: number,
    dash: BoardShape['dash'] = 'draw'
  ) => {
    const timed = timing(beat)
    shapes.push({
      id: `a${shapes.length}`,
      kind: 'arrow',
      text,
      x: 0,
      y: 0,
      w: 200,
      h: 0,
      from,
      to,
      parent: null,
      color: 'black',
      fill: 'none',
      size: 'm',
      dash,
      at: timed.at,
      anchor: timed.anchor,
      points: [],
      data: [],
    })
  }

  /** Returns the id of the shape a line produced, for the things that join. */
  const walk = (node: SlateNode, parent: string | null): string | null => {
    if (node.kind === 'arrow' || node.kind === 'rel') return null

    // Pure arrangement. The board flows its shapes itself, so a `row` or the
    // two halves of a `compare` are simply their contents — the one thing the
    // board layout is already good at is putting siblings beside each other.
    if ((LAYOUT_KINDS as readonly string[]).includes(node.kind) || node.kind === 'compare') {
      for (const child of node.children) walk(child, parent)
      return null
    }

    // A sequence, with the arrows the author did not have to write. Each
    // connector takes the beat of the step it leads to, so the line is drawn as
    // the voice reaches the thing at the end of it.
    if (node.kind === 'flow') {
      const made: { id: string; beat: number }[] = []
      for (const child of node.children) {
        const id = walk(child, parent)
        if (id) made.push({ id, beat: child.beat })
      }
      for (let i = 0; i + 1 < made.length; i++) {
        link(made[i].id, made[i + 1].id, i === 0 ? node.text : '', made[i + 1].beat)
      }
      if (node.layout === 'cycle' && made.length > 1) {
        link(made[made.length - 1].id, made[0].id, '', made[made.length - 1].beat, 'dashed')
      }
      return null
    }

    // A chart's numbers live in `data`, and its rows are the numbers.
    if (node.kind === 'chart') {
      const which = (node.text.match(/^(bar|pie|line)\b/)?.[1] ?? 'bar') as keyof typeof CHART_KIND
      const shape = emit(node, CHART_KIND[which], { parent })
      shape.text = node.text.replace(/^(bar|pie|line)\s*/, '').replace(/^"|"$/g, '')
      shape.data = node.rows
        .map((row) => {
          const parsedRow = String(row.text).match(/^(.*?)\s+(-?[\d.]+)$/)
          return parsedRow
            ? { label: parsedRow[1].trim(), value: Number(parsedRow[2]) }
            : { label: String(row.text), value: 0 }
        })
        .slice(0, 12)
      // A chart arrives whole — it is one picture, and half a chart is a lie.
      const first = node.rows.find((row) => row.beat)
      if (first) Object.assign(shape, timing(first.beat))
      return shape.id
    }

    const kind = KINDS[node.kind]
    if (!kind) return null

    // A block whose rows are separately timed becomes one shape per row. The
    // board has no way to reveal the third layer of a stack on its own beat,
    // and a six-row table landing whole while the voice is on row one was the
    // single worst thing about the Chalk boards.
    const staggered =
      node.rows.length > 1 &&
      new Set(node.rows.map((row) => row.beat)).size > 1 &&
      (node.kind === 'stk' || node.kind === 'tbl')

    if (staggered && node.kind === 'stk') {
      for (const row of node.rows) {
        const beat = timing(row.beat || node.beat)
        emit(node, 'box', {
          id: `${node.name ?? 's'}${shapes.length}`,
          text: String(row.text),
          parent,
          ...beat,
        })
      }
      return null
    }
    if (staggered && node.kind === 'tbl') {
      // One shard a row, sharing a group so the layout moves them as one block
      // and they read as a table filling in rather than as three small tables
      // dealt around the board. The header rides with the first shard only: a
      // table of headings and nothing else is a promise, not a fact, and a
      // header repeated on every row is three tables again.
      const header = node.rows.find((row) => row.header)
      const group = `t${node.name ?? shapes.length}`
      let corner: { x: number; y: number } | null = null
      let stacked = 0

      for (const row of node.rows) {
        if (row.header) continue
        const beat = timing(row.beat || node.beat)
        const withHeader = !corner && header?.cells
        const cells = (withHeader ? [header!.cells, row.cells] : [row.cells]).filter(
          Boolean
        ) as string[][]

        const shard = emit(node, 'table', {
          id: `${node.name ?? 't'}${shapes.length}`,
          text: cells.map((line) => line.join('|')).join('\n'),
          parent,
          group,
          ...beat,
        })

        // Stacked directly under the first shard rather than wherever the
        // placement sketch put them. They share a group, so the layout moves
        // all three as one block — and a block of rows in a column is a table
        // filling in, while three rows dealt across the board is three tables.
        corner ??= { x: shard.x, y: shard.y }
        shard.x = corner.x
        shard.y = corner.y + stacked
        shard.h = withHeader ? 110 : 56
        stacked += shard.h + 4
      }
      return null
    }

    const shape = emit(node, kind, { parent })

    // The block forms the board can draw whole.
    if (node.rows.length) {
      if (node.kind === 'stk') shape.text = node.rows.map((row) => row.text).join('\n')
      if (node.kind === 'arr') shape.text = node.rows.map((row) => row.text).join('|')
      if (node.kind === 'tbl') {
        shape.text = node.rows.map((row) => (row.cells ?? []).join('|')).join('\n')
      }
    }
    // A captioned symbol is a glyph and a line of words. The board has no
    // single shape for that pairing, so it becomes the glyph with the words
    // attached under it — which is where they sit anyway.
    if (node.kind === 'sym' || node.kind === 'ico') {
      const [glyph, caption] = splitCaption(node.text)
      shape.text = glyph
      if (caption) {
        emit(asNode({ text: caption, stat: null, role: node.role, beat: node.beat }), 'text', {
          id: `${shape.id}-said`,
          parent: shape.id,
          size: 's',
        })
      }
    }
    if (node.kind === 'callout') shape.size = 'l'
    if (node.kind === 'code') shape.text = node.text.split(' / ').join('\n')
    if (node.kind === 'arr' && !node.rows.length) shape.text = node.text.split(',').map((c) => c.trim()).join('|')
    // A boundary rather than a part: dashed, so a group of three boxes does not
    // read as a fourth box with three inside it.
    if (node.kind === 'group') shape.dash = 'dashed'

    for (const child of node.children) walk(child, shape.id)
    // A fork's ways out, once the decision has an id to leave from.
    for (const arm of node.arms) armLinks.push({ from: shape.id, arm })
    return shape.id
  }

  /** Deferred until every shape exists, the same way arrows are. */
  const armLinks: { from: string; arm: SlateNode['arms'][number] }[] = []

  for (const row of scene.rows) for (const node of row) walk(node, null)

  // A replacement is a shape in its own right here: the board cannot erase, so
  // the exchange is drawn as the new reading arriving with a dashed line from
  // what it replaced.
  const swapLinks: { from: string; to: string; beat: number }[] = []
  for (const swap of scene.swaps) {
    if (swap.node) walk(swap.node, null)
    swapLinks.push({ from: swap.from, to: swap.to, beat: swap.beat })
  }

  // Likewise a transform: the same shape saying something new is two shapes
  // here, joined, which is what a person at a real board draws when they have
  // run out of eraser.
  for (const morph of scene.morphs) {
    const source = shapes.find((shape) => shape.id === morph.target)
    if (!source) continue
    const become = emit(asNode(morph), source.kind, {
      id: `${morph.target}-${morph.beat}`,
      parent: source.parent,
    })
    swapLinks.push({ from: morph.target, to: become.id, beat: morph.beat })
  }

  // Connectors, once every end exists to point at.
  const drawn = new Set(shapes.map((shape) => shape.id))
  for (const node of allNodes(scene)) {
    if (node.kind !== 'arrow' && node.kind !== 'rel') continue
    const ends = node.names ?? []

    // A named relationship has no direction of travel, and the board has no
    // connector that says so — so it is drawn dashed and *labelled with the
    // relation*, which at least stops "shares" reading as "becomes".
    if (node.kind === 'rel') {
      if (!drawn.has(ends[0]) || !drawn.has(ends[1])) continue
      link(ends[0], ends[1], [node.rel, node.text].filter(Boolean).join(' · '), node.beat, 'dashed')
      continue
    }

    // A chain is sugar for one arrow a link, so `-> a b c` is two arrows.
    for (let i = 0; i + 1 < ends.length; i++) {
      if (!drawn.has(ends[i]) || !drawn.has(ends[i + 1])) continue
      link(
        ends[i],
        ends[i + 1],
        i === 0 ? node.text : '',
        node.beat,
        node.style === '-->' ? 'dashed' : 'draw'
      )
    }
  }

  for (const { from, arm } of armLinks) {
    if (drawn.has(from) && drawn.has(arm.target)) link(from, arm.target, arm.label, arm.beat)
  }
  for (const swap of swapLinks) {
    if (drawn.has(swap.from) && drawn.has(swap.to)) {
      link(swap.from, swap.to, 'becomes', swap.beat, 'dashed')
    }
  }

  // Marks: point at what is already there rather than drawing it again.
  for (const mark of scene.marks) {
    // A row of a block gets the whole block marked. The board splits a
    // staggered block into shards with generated ids, so there is no row to
    // aim at — and ringing the table is closer to the intent than ringing
    // nothing, which is what happened before.
    const target = shapes.find((shape) => shape.id === splitTarget(mark.target).name)
    if (!target) continue
    const beat = timing(mark.beat)

    if (mark.kind === 'note') {
      // A remark about a shape is a line under it, which is what the board's
      // nesting already does with an attached text.
      shapes.push({
        id: `n${shapes.length}`,
        kind: 'text',
        text: mark.text ?? '',
        x: target.x,
        y: target.y,
        w: 420,
        h: 60,
        from: null,
        to: null,
        parent: target.id,
        color: 'grey',
        fill: 'none',
        size: 's',
        dash: 'draw',
        ...beat,
        points: [],
        data: [],
      })
      continue
    }
    // `dim`, `hide` and `show` have no board equivalent — ink goes on and stays
    // — so they are dropped rather than faked with a mark that means something
    // else. `focus` keeps the half it can honour: the ring round what matters,
    // without the pushing back of everything else.
    if (mark.kind === 'dim' || mark.kind === 'hide' || mark.kind === 'show') continue

    shapes.push({
      id: `m${shapes.length}`,
      kind: mark.kind === 'hl' ? 'highlight' : 'ring',
      text: '',
      // Given the target's own box, which is what attachRings fits itself to.
      x: target.x,
      y: target.y,
      w: target.w,
      h: target.h,
      from: null,
      to: null,
      parent: null,
      color: mark.kind === 'hl' ? 'yellow' : mark.kind === 'focus' ? 'violet' : 'red',
      fill: 'none',
      size: 'm',
      dash: 'draw',
      ...beat,
      points:
        mark.kind === 'hl'
          ? [
              { x: target.x, y: target.y + target.h / 2 },
              { x: Math.min(SCENE_W, target.x + target.w), y: target.y + target.h / 2 },
            ]
          : [],
      data: [],
    })
  }

  // What the scene carries forward is redrawn greyed: the board pans between
  // scenes rather than keeping one, so "already there" has to be said again.
  for (const carried of scene.carries) {
    if (carried === 'all' || shapes.some((shape) => shape.id === carried)) continue
    shapes.unshift({
      id: carried,
      kind: 'box',
      text: carried.toUpperCase(),
      x: 60,
      y: 40,
      w: 300,
      h: 120,
      from: null,
      to: null,
      parent: null,
      color: 'grey',
      fill: 'none',
      size: 'm',
      dash: 'dotted',
      at: 0,
      anchor: '',
      points: [],
      data: [],
    })
  }

  return {
    id: `scene-${scene.n}`,
    heading: '',
    narration: beats.join(' '),
    diagram: { source: '', timing: [] },
    shapes,
  }
}

/** Every scene number a document mentions, so its narration can be gathered. */
export function scenesIn(source: string): number[] {
  return parseLesson(source).scenes.map((scene) => scene.n)
}
