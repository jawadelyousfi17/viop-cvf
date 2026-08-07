/**
 * Slate — a line-based language for boards, timed to narration.
 *
 * Chalk with the guesswork taken out. The one change everything else follows
 * from: an anchor is a beat NUMBER, not a phrase hunted for in prose. A Chalk
 * anchor that missed still drew its shape, just on the wrong beat, and nothing
 * said so. A beat number cannot half-work — it is either in range or it is a
 * build error.
 *
 * What the language learned since: an explanation is not only a set of things
 * that appear. It is things that *belong together* (`group`, `row`, `compare`),
 * things that *become* other things (`transform`, `replace`), things that are
 * *related without flowing* (`shares`, `mounts`, `maps`), and attention that
 * *moves* (`focus`, `hide`). All of it stays semantic: the author says what a
 * thing means and when, and the renderer decides where it goes. There is still
 * no way to write a coordinate, and there never will be.
 *
 * See docs/slate.md for the language. This file is the parser and the timing;
 * lib/slate-lint.ts is what refuses to build.
 */

/** Containers: things that hold other things, each meaning something distinct. */
export const CONTAINERS = [
  'box',
  'actor',
  'step',
  'choice',
  'store',
  'group',
  'branch',
  'compare',
] as const

/**
 * Arrangement without meaning. `group` says "these belong together"; `row` says
 * only "these sit beside each other" — the weakest thing an author can ask for
 * and still be asking for something, which is exactly why it has to exist. The
 * alternative was inventing an arrow that meant nothing.
 */
export const LAYOUT_KINDS = ['row', 'column', 'col', 'grid', 'split', 'center'] as const

/** Structures with a block form — one beat per row. */
export const BLOCKS = ['stk', 'arr', 'tbl', 'chart', 'flow'] as const

/** The block kinds whose indented lines are rows rather than shapes. */
const ROW_BLOCKS = ['stk', 'arr', 'tbl', 'chart'] as const

/**
 * Relationships that are not flow.
 *
 * `->` says "and then". Most of what a system diagram needs to say is not that:
 * a container and the host *share* a kernel, a volume *mounts* into a path, a
 * port *maps* to a port. Drawing those as arrows made every diagram look like a
 * pipeline. Naming the relation lets the renderer choose a connector that does
 * not imply a direction of travel.
 */
export const RELATIONS = ['depends', 'contains', 'shares', 'maps', 'mounts', 'uses'] as const
export type Relation = (typeof RELATIONS)[number]

export const COLOURS = ['blue', 'green', 'red', 'violet', 'yellow', 'orange', 'grey'] as const
export type Colour = (typeof COLOURS)[number]

export type SlateLayout = 'row' | 'column' | 'grid' | 'split' | 'center' | 'cycle'

/** Every kind a line may open with. An unrecognised one is a build error. */
export const KIND_NAMES: readonly string[] = [
  ...CONTAINERS,
  ...LAYOUT_KINDS,
  ...BLOCKS,
  'code',
  'img',
  'sym',
  'ico',
  'label',
  'lab',
  'callout',
  'txt',
  'item',
]

const KIND_SET = new Set(KIND_NAMES)

export const isKind = (word: string) => KIND_SET.has(word)

export interface SlateNode {
  kind: string
  name: string | null
  text: string
  /** The `[...]` slot: a number set large inside the shape, under its label. */
  stat: string | null
  /** A declared colour role, resolved through the lesson's `~` declarations. */
  role: string | null
  /** A literal colour. Still drawn; the linter says why it shouldn't be. */
  colour: string | null
  /** How this shape arranges what it holds. Null means "whatever suits". */
  layout: SlateLayout | null
  beatTok: string | null
  /** Resolved beat, 1-based within the scene. */
  beat: number
  /** The last beat of a `|3..5` range. Zero when the beat is a moment. */
  beatEnd: number
  /** `|3*` — this beat is deliberately shared with another shape. */
  shared: boolean
  /** `|3+` — emphasised from its beat to the end of the scene. */
  held: boolean
  children: SlateNode[]
  rows: SlateRow[]
  /** `branch` arms: a labelled way out of a decision. */
  arms: SlateArm[]
  /** Arrow ends, in order. A chain has more than two. */
  names?: string[]
  style?: '->' | '-->' | '<->'
  /** Set on `kind === 'rel'`: which relationship this line asserts. */
  rel?: Relation
  line: number
}

export interface SlateRow {
  text?: string
  cells?: string[]
  header?: boolean
  beatTok: string | null
  beat: number
  beatEnd: number
  line: number
}

/** One labelled way out of a `branch`. */
export interface SlateArm {
  label: string
  target: string
  beatTok: string | null
  beat: number
  line: number
}

export interface SlateMark {
  kind: 'hl' | 'ring' | 'dim' | 'note' | 'focus' | 'show' | 'hide'
  target: string
  text?: string
  beatTok: string | null
  beat: number
  /** `focus #x |2..4` — attention that lifts again, without a timeline. */
  beatEnd: number
  line: number
}

/**
 * One shape becoming a different one: `transform #source |3` with the new
 * reading under it.
 *
 * Kept apart from the node it changes because the target may be defined later
 * in the scene, or carried in from an earlier one. Applied by name.
 */
export interface SlateMorph {
  target: string
  text: string
  stat: string | null
  role: string | null
  beatTok: string | null
  beat: number
  line: number
}

/** One shape standing down so another can take its place. */
export interface SlateSwap {
  from: string
  to: string
  /** Defined by the block form. Null when both ends already exist. */
  node: SlateNode | null
  beatTok: string | null
  beat: number
  line: number
}

export interface SlateScene {
  n: number
  /** The author's name for the scene. Never rendered; said in every error. */
  title: string
  /** One sentence a beat, numbered from one. */
  beats: string[]
  /** `--- 7 [6 beats]` — what the author believes the narration is. */
  declared: number
  rows: SlateNode[][]
  marks: SlateMark[]
  morphs: SlateMorph[]
  swaps: SlateSwap[]
  /** Names brought forward from an earlier scene. */
  carries: string[]
  shapes: SlateNode[]
}

export interface SlateProblem {
  level: 'err' | 'warn'
  line?: number
  msg: string
}

export interface SlateLesson {
  title: string
  sub: string
  /** Role name to colour, from the `~` declarations. */
  roles: Record<string, string>
  /** `symbol docker = container` — the lesson's own words for known glyphs. */
  symbols: Record<string, string>
  scenes: SlateScene[]
  problems: SlateProblem[]
}

/** How a scene is named in a message. The number alone was never enough. */
export function where(scene: SlateScene) {
  return scene.title ? `scene ${scene.n} “${scene.title}”` : `scene ${scene.n}`
}

/**
 * Splits a paragraph into sentences, so a script written as prose still becomes
 * one beat per sentence.
 *
 * The lookahead keeps "example.com." and "3.5" in one piece: a full stop only
 * ends a sentence when what follows could start one.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+(?=[A-Z"“'(\d])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Reads a written script into scenes of beats.
 *
 * Scenes are opened by `--- n`. Anything else is narration: a `say` line is one
 * beat as written, and a paragraph is split into one beat per sentence.
 */
export function parseScript(source: string): Map<number, string[]> {
  const scenes = new Map<number, string[]>()
  let current: number | null = null

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue

    const heading = line.match(/^-{2,}\s*(?:SCENE\s*)?(\d+)?/i)
    if (heading) {
      current = heading[1] ? Number(heading[1]) : scenes.size + 1
      if (!scenes.has(current)) scenes.set(current, [])
      continue
    }
    if (current === null) {
      current = 1
      scenes.set(1, [])
    }
    if (/^say\s+/i.test(line)) scenes.get(current)!.push(line.replace(/^say\s+/i, ''))
    else for (const sentence of splitSentences(line)) scenes.get(current)!.push(sentence)
  }

  return scenes
}

/** A beat token: a number, a range, a walk, or a phrase from the old world. */
const BEAT_TOKEN = /^(?:\d+(?:\.\.\d+)?[*+]?|\++|=)$/

/**
 * Pulls a trailing `|beat` off a line.
 *
 * The last bar wins, so a table row full of bars still gets its beat read off
 * the end rather than out of its own contents.
 */
function stripBeat(text: string): [string, string | null] {
  const bar = text.lastIndexOf('|')
  if (bar < 0) return [text, null]

  const token = text.slice(bar + 1).trim()
  if (!token) return [text.slice(0, bar).trim(), null]
  if (BEAT_TOKEN.test(token) || /^[A-Za-z0-9"'(].{1,80}$/.test(token)) {
    return [text.slice(0, bar).trim(), token]
  }
  return [text, null]
}

/**
 * A trailing `// remark`.
 *
 * Requires the space before it, so a URL keeps its slashes. `#` is not a
 * comment character anywhere but the start of a line: it is how names are
 * written, and a language cannot spend the same character twice.
 */
function stripComment(text: string): string {
  return text.replace(/\s+\/\/(?:\s.*)?$/, '').trim()
}

/** An empty node of a kind. Shared with the YAML front end. */
export function blankNode(kind: string, line: number): SlateNode {
  return {
    kind,
    name: null,
    text: '',
    stat: null,
    role: null,
    colour: null,
    layout: null,
    beatTok: null,
    beat: 0,
    beatEnd: 0,
    shared: false,
    held: false,
    children: [],
    rows: [],
    arms: [],
    line,
  }
}

/**
 * `kind #name TEXT [stat] ~role |beat` — everything after the kind optional.
 *
 * `implicit` supplies the kind for the places where a bare line is unambiguous:
 * the steps of a `flow`, the sides of a `compare`. Writing `box` four times
 * inside a structure that can only hold boxes is ceremony, and ceremony is what
 * the language is for removing.
 */
function parseShapeLine(line: string, lineNo: number, implicit?: string): SlateNode {
  let rest = line.trim()
  const first = rest.split(/\s+/)[0]

  let kind: string
  if (implicit && !isKind(first)) {
    kind = implicit
  } else {
    kind = first === '+' ? 'item' : first
    rest = rest.slice(first.length).trim()
  }

  const node = blankNode(kind === 'col' ? 'column' : kind, lineNo)

  ;[rest, node.beatTok] = stripBeat(rest)

  rest = rest.replace(/(?:^|\s)~([a-zA-Z][\w-]*)/, (_, r: string) => {
    node.role = r
    return ' '
  })
  rest = rest.replace(/(?:^|\s)@([a-z]+)/, (_, c: string) => {
    node.colour = c
    return ' '
  })
  // Not on `code`. Its text is someone else's language, and `["python",
  // "app.py"]` is a list literal, not a stat slot — the line form was silently
  // eating the brackets and everything in them off the end of every Dockerfile
  // and argv it was ever given.
  if (node.kind !== 'code') {
    rest = rest.replace(/\[([^\]]*)\]/, (_, s: string) => {
      node.stat = s.trim()
      return ' '
    })
  }

  // `group row #machines` / `flow horizontal` — the arrangement rides on the
  // kind rather than needing a line of its own.
  const arranged = rest.match(/^(row|column|col|grid|split|center|horizontal|vertical|cycle)\b\s*/i)
  if (arranged && (node.kind === 'group' || node.kind === 'flow')) {
    node.layout = normaliseLayout(arranged[1])
    rest = rest.slice(arranged[0].length)
  }

  const named = rest.match(/^#(\S+)\s*/)
  if (named) {
    node.name = named[1]
    rest = rest.slice(named[0].length)
  }

  node.text = rest.replace(/\s{2,}/g, ' ').trim()
  return node
}

export function normaliseLayout(word: string): SlateLayout {
  const w = word.toLowerCase()
  if (w === 'horizontal') return 'row'
  if (w === 'vertical') return 'column'
  if (w === 'col') return 'column'
  return w as SlateLayout
}

/** The implicit kind for a bare line inside each container. */
function implicitKind(parent: SlateNode | null): string | undefined {
  if (!parent) return undefined
  if (parent.kind === 'flow') return 'step'
  if (parent.kind === 'compare') return 'box'
  if (parent.kind === 'group' || (LAYOUT_KINDS as readonly string[]).includes(parent.kind)) {
    return 'box'
  }
  return undefined
}

/**
 * Reads a Slate document, against a script that may already be written.
 *
 * Narration can come from either side: `say` lines in the board source, or a
 * separate script keyed by scene number. The second is the case that matters —
 * the words exist, they are recorded, and the board is the only thing missing.
 */
export function parseLesson(
  source: string,
  scriptScenes: Map<number, string[]> = new Map()
): SlateLesson {
  const lesson: SlateLesson = {
    title: '',
    sub: '',
    roles: {},
    symbols: {},
    scenes: [],
    problems: [],
  }
  let scene: SlateScene | null = null
  let row: SlateNode[] | null = null
  let stack: SlateNode[] = []

  const openScene = (n: number, title: string, declared: number) => {
    scene = {
      n,
      title,
      beats: (scriptScenes.get(n) ?? []).slice(),
      declared,
      rows: [],
      marks: [],
      morphs: [],
      swaps: [],
      carries: [],
      shapes: [],
    }
    lesson.scenes.push(scene)
    row = null
    stack = []
  }

  source.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.replace(/\t/g, '  ')
    let trimmed = line.trim()
    const lineNo = index + 1

    // A blank line ends a row, and with it any open container.
    if (!trimmed) {
      row = null
      stack = []
      return
    }
    // A whole line of remark. `#` keeps working at the left margin because the
    // fixed-script form numbers its sentences that way.
    if (/^\/\//.test(trimmed) || /^#\s/.test(trimmed)) return

    const indent = Math.floor((line.match(/^ */)?.[0].length ?? 0) / 2)

    // `code` is the one kind whose text is someone else's language, and `//` is
    // a comment in most of them. Its lines keep their slashes.
    if (!/^code\b/.test(trimmed)) trimmed = stripComment(trimmed)
    if (!trimmed) return

    // The document's own header lines, and only at the left margin. A table's
    // header row also starts with a colon — `: Record | What it does` — and
    // reading that as the lesson's summary both lost the header and overwrote
    // the summary with a row of table cells.
    if (indent === 0) {
      if (/^=\s/.test(trimmed)) {
        lesson.title = trimmed.slice(2).trim()
        return
      }
      if (/^:\s/.test(trimmed)) {
        lesson.sub = trimmed.slice(2).trim()
        return
      }
      // `~ role colour` — a declaration, not a use.
      const declared = trimmed.match(/^~\s+(\S+)\s+(\S+)/)
      if (declared) {
        lesson.roles[declared[1]] = declared[2]
        return
      }
      // `symbol docker = container` — the lesson's own word for a known glyph.
      const alias = trimmed.match(/^symbol\s+(\S+)\s*=\s*(.+)$/i)
      if (alias) {
        lesson.symbols[alias[1].toLowerCase()] = alias[2].trim().toLowerCase()
        return
      }
    }

    if (/^-{3,}/.test(trimmed) && !/^->/.test(trimmed)) {
      const heading = trimmed.match(/^-{3,}\s*(?:SCENE\s*)?(\d+)?\s*(.*)$/i)
      const tail = heading?.[2] ?? ''
      const titled = tail.match(/"([^"]*)"|“([^”]*)”/)
      const counted = tail.match(/\[\s*(\d+)\s*(?:beats?)?\s*\]|\bbeats?\s*=\s*(\d+)/i)
      openScene(
        heading?.[1] ? Number(heading[1]) : lesson.scenes.length + 1,
        (titled?.[1] ?? titled?.[2] ?? '').trim(),
        Number(counted?.[1] ?? counted?.[2] ?? 0)
      )
      return
    }
    if (!scene) openScene(1, '', 0)
    const here = scene as SlateScene

    if (/^say\s+/i.test(trimmed)) {
      here.beats.push(trimmed.replace(/^say\s+/i, ''))
      return
    }

    const parent = indent > 0 ? stack[indent - 1] : null

    const addToRow = (node: SlateNode) => {
      if (!row) {
        row = []
        here.rows.push(row)
      }
      row.push(node)
    }

    // ---- connectors -------------------------------------------------------
    const arrow = trimmed.match(/^(-->|->|<->)\s+(.+)$/)
    if (arrow) {
      let rest = arrow[2]
      let beatTok: string | null = null
      ;[rest, beatTok] = stripBeat(rest)
      const [ends, ...label] = rest.split(/\s+:\s+/)
      const node = blankNode('arrow', lineNo)
      node.style = arrow[1] as SlateNode['style']
      node.names = ends.trim().split(/\s+/).map((end) => end.replace(/^#/, ''))
      node.text = label.join(' : ').trim()
      node.beatTok = beatTok
      addToRow(node)
      here.shapes.push(node)
      return
    }

    // `shares container kernel |3` — a relationship that is not a flow.
    const related = trimmed.match(
      new RegExp(`^(${RELATIONS.join('|')})\\s+#?(\\S+)\\s+#?(\\S+)\\s*(.*)$`, 'i')
    )
    if (related) {
      let rest = related[4] ?? ''
      let beatTok: string | null = null
      ;[rest, beatTok] = stripBeat(rest)
      const node = blankNode('rel', lineNo)
      node.rel = related[1].toLowerCase() as Relation
      node.names = [related[2].replace(/^#/, ''), related[3].replace(/^#/, '')]
      node.text = rest.replace(/^:\s*/, '').trim()
      node.beatTok = beatTok
      addToRow(node)
      here.shapes.push(node)
      return
    }

    // ---- attention --------------------------------------------------------
    // The `#` is required. Without it `dim the lights` — a perfectly ordinary
    // layer of a `stk` — would silently become a command instead of a label.
    const marked = trimmed.match(/^(hl|ring|dim|focus|show|hide)\s+#(\S+)\s*(.*)$/)
    if (marked) {
      const [, kind, target, tail] = marked
      const [, beatTok] = stripBeat('x ' + tail)
      here.marks.push({
        kind: kind as SlateMark['kind'],
        target: target.replace(/^#/, ''),
        beatTok,
        beat: 0,
        beatEnd: 0,
        line: lineNo,
      })
      return
    }

    const noted = trimmed.match(/^note\s+#(\S+)\s+(.+)$/)
    if (noted) {
      let rest = noted[2]
      let beatTok: string | null = null
      ;[rest, beatTok] = stripBeat(rest)
      here.marks.push({
        kind: 'note',
        target: noted[1].replace(/^#/, ''),
        text: rest,
        beatTok,
        beat: 0,
        beatEnd: 0,
        line: lineNo,
      })
      return
    }

    // ---- change -----------------------------------------------------------
    // `transform #source |3` with the new reading under it, or on the line.
    const morphed = trimmed.match(/^transform\s+#(\S+)\s*(.*)$/)
    if (morphed) {
      let rest = morphed[2] ?? ''
      let beatTok: string | null = null
      ;[rest, beatTok] = stripBeat(rest)
      const morph: SlateMorph = {
        target: morphed[1].replace(/^#/, ''),
        text: '',
        stat: null,
        role: null,
        beatTok,
        beat: 0,
        line: lineNo,
      }
      if (rest.trim()) applyMorphText(morph, rest.trim())
      here.morphs.push(morph)
      // Held open so an indented line below can supply the new reading.
      const holder = blankNode('transform', lineNo)
      holder.names = [morph.target]
      stack[indent] = holder
      stack.length = indent + 1
      return
    }

    // `replace #code #image |3`, or `replace #code` with the new shape under it.
    const replaced = trimmed.match(/^replace\s+#(\S+)\s*(.*)$/)
    if (replaced) {
      let rest = replaced[2] ?? ''
      let beatTok: string | null = null
      ;[rest, beatTok] = stripBeat(rest)
      const to = rest.trim().replace(/^#/, '')
      const swap: SlateSwap = {
        from: replaced[1].replace(/^#/, ''),
        to,
        node: null,
        beatTok,
        beat: 0,
        line: lineNo,
      }
      here.swaps.push(swap)
      const holder = blankNode('replace', lineNo)
      holder.names = [swap.from]
      stack[indent] = holder
      stack.length = indent + 1
      return
    }

    if (/^(carry|recall)\s+/.test(trimmed)) {
      for (const token of trimmed.replace(/^(carry|recall)\s+/, '').split(/\s+/)) {
        here.carries.push(token.replace(/^#/, ''))
      }
      return
    }

    // `layout row` inside a container, for the times the container is already
    // written and only its arrangement is in question.
    const arranged = trimmed.match(/^layout\s+(row|column|col|grid|split|center|cycle)$/i)
    if (arranged && parent) {
      parent.layout = normaliseLayout(arranged[1])
      return
    }

    // ---- lines that belong to the line above ------------------------------
    if (parent?.kind === 'transform') {
      const morph = here.morphs[here.morphs.length - 1]
      if (morph && !morph.text) {
        applyMorphText(morph, trimmed)
        if (morph.beatTok == null) {
          const [, beatTok] = stripBeat(trimmed)
          morph.beatTok = beatTok
        }
      }
      return
    }

    if (parent?.kind === 'replace') {
      const swap = here.swaps[here.swaps.length - 1]
      const node = parseShapeLine(trimmed, lineNo, 'box')
      node.name ??= `${swap?.from ?? 'r'}-into`
      if (swap) {
        swap.node = node
        swap.to = node.name
        // The exchange and the shape arriving are one moment, so they are one
        // number — written on whichever of the two lines suited the author.
        node.beatTok ??= swap.beatTok
        swap.beatTok = null
      }
      here.shapes.push(node)
      stack[indent] = node
      stack.length = indent + 1
      return
    }

    // A `branch` arm: `YES -> cache`. Written inside the decision it leaves,
    // because a fork read as three separate lines is not read as a fork.
    if (parent && (parent.kind === 'branch' || parent.kind === 'choice')) {
      const arm = trimmed.match(/^(.+?)\s*->\s*#?(\S+)\s*(.*)$/)
      if (arm) {
        const [, beatTok] = stripBeat('x ' + (arm[3] ?? ''))
        parent.arms.push({
          label: arm[1].trim(),
          target: arm[2].replace(/^#/, ''),
          beatTok,
          beat: 0,
          line: lineNo,
        })
        return
      }
    }

    // Inside a block, a line is a row rather than a shape: no kind token, and
    // its own beat, which is the whole reason blocks have a block form.
    if (parent && (ROW_BLOCKS as readonly string[]).includes(parent.kind)) {
      if (parent.kind === 'tbl') {
        const cells = trimmed.split('|').map((c) => c.trim())
        let beatTok: string | null = null
        const last = cells[cells.length - 1]
        if (BEAT_TOKEN.test(last)) {
          beatTok = last
          cells.pop()
        }
        const header = cells[0].startsWith(':')
        if (header) cells[0] = cells[0].replace(/^:\s*/, '')
        parent.rows.push({ cells, header, beatTok, beat: 0, beatEnd: 0, line: lineNo })
      } else {
        const [text, beatTok] = stripBeat(trimmed)
        parent.rows.push({ text, beatTok, beat: 0, beatEnd: 0, line: lineNo })
      }
      return
    }

    const node = parseShapeLine(trimmed, lineNo, implicitKind(parent))
    here.shapes.push(node)

    const holds =
      parent &&
      ((CONTAINERS as readonly string[]).includes(parent.kind) ||
        (LAYOUT_KINDS as readonly string[]).includes(parent.kind) ||
        parent.kind === 'flow')

    if (holds) parent!.children.push(node)
    else addToRow(node)

    stack[indent] = node
    stack.length = indent + 1
  })

  resolveBeats(lesson)
  return lesson
}

/** A transform's new reading: text, and optionally a new stat or role. */
function applyMorphText(morph: SlateMorph, source: string) {
  const parsed = parseShapeLine(source, morph.line, 'box')
  morph.text = parsed.text
  morph.stat = parsed.stat
  morph.role = parsed.role
}

/** Everything in a scene that carries a beat token, in the order it was written. */
interface Carrier {
  line: number
  tok: string | null
  /**
   * What an absent beat means. A shape settles between its anchored
   * neighbours, which needs a second pass; a mark has no neighbours to sit
   * between, so it takes the beat the scene had reached where it was written.
   */
  blank: 'interpolate' | 'last'
  apply: (beat: number, end: number, shared: boolean, held: boolean) => void
}

/**
 * Turns every beat token into a number, and reports the ones that cannot be.
 *
 * `|3` is a beat, `|=` repeats the last one, `|+` and `|++` walk forward from
 * it, `|3..5` lasts, `|3*` says a shared beat was meant, and a bare phrase is
 * still accepted — matched against the narration the way Chalk did, but a miss
 * is an error rather than a shrug.
 *
 * Resolved in written order rather than in tree order, because `|+` means "the
 * next one after the last" and the only "last" an author can see is the line
 * above the one they are typing.
 */
export function resolveBeats(lesson: SlateLesson) {
  for (const scene of lesson.scenes) {
    // A declared count lets a board be checked against narration it has not
    // been given — which is most boards, most of the time, while they are
    // being written.
    if (scene.declared && scene.beats.length && scene.declared !== scene.beats.length) {
      lesson.problems.push({
        level: 'err',
        msg: `${where(scene)} declares ${scene.declared} beats but its narration has ${scene.beats.length}`,
      })
    }
    const total = scene.beats.length || scene.declared
    let last = 0

    const norm = (s: string) =>
      s.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()
    const beats = scene.beats.map(norm)

    const past = (n: number, line: number) => {
      if (total && n > total) {
        lesson.problems.push({
          level: 'err',
          line,
          msg: `${where(scene)}, beat ${n} is past the last beat (${total})`,
        })
      }
    }

    type Resolved = { beat: number; end: number; shared: boolean; held: boolean }

    const resolve = (token: string | null, line: number): Resolved | null => {
      if (token == null) return null
      if (token === '=') return { beat: last, end: 0, shared: false, held: false }

      const walk = token.match(/^\++$/)
      if (walk) {
        const n = Math.min(last + walk[0].length, Math.max(total, 1))
        return { beat: n, end: 0, shared: false, held: false }
      }

      const numeric = token.match(/^(\d+)(?:\.\.(\d+))?([*+]?)$/)
      if (numeric) {
        const n = Number(numeric[1])
        const end = numeric[2] ? Number(numeric[2]) : 0
        past(n, line)
        if (end) {
          past(end, line)
          if (end < n) {
            lesson.problems.push({
              level: 'err',
              line,
              msg: `${where(scene)}, beat range |${n}..${end} ends before it starts`,
            })
          }
        }
        return { beat: n, end, shared: numeric[3] === '*', held: numeric[3] === '+' }
      }

      const found = beats.findIndex((beat) => beat.includes(norm(token)))
      if (found < 0) {
        lesson.problems.push({
          level: 'err',
          line,
          msg: `anchor “${token}” is not in ${where(scene)}'s narration`,
        })
        return null
      }
      return { beat: found + 1, end: 0, shared: false, held: false }
    }

    // Gathered rather than walked, so a mark written between two shapes
    // resolves between them.
    const carriers: Carrier[] = []
    const holder = new Map<SlateNode, SlateNode | null>()
    const collect = (node: SlateNode, parent: SlateNode | null = null) => {
      holder.set(node, parent)
      carriers.push({
        line: node.line,
        tok: node.beatTok,
        blank: 'interpolate',
        apply: (beat, end, shared, held) => {
          node.beat = beat
          node.beatEnd = end
          node.shared = shared
          node.held = held
        },
      })
      for (const row of node.rows) {
        carriers.push({
          line: row.line,
          tok: row.beatTok,
          blank: 'interpolate',
          apply: (beat, end) => {
            row.beat = beat
            row.beatEnd = end
          },
        })
      }
      for (const arm of node.arms) {
        carriers.push({
          line: arm.line,
          tok: arm.beatTok,
          blank: 'interpolate',
          apply: (beat) => (arm.beat = beat),
        })
      }
      for (const child of node.children) collect(child, node)
    }

    for (const row of scene.rows) for (const node of row) collect(node)
    for (const swap of scene.swaps) {
      // A block-form replacement takes its beat from the shape it introduces,
      // which already carries one. Only the inline form needs a carrier.
      if (swap.node) collect(swap.node)
      else {
        carriers.push({
          line: swap.line,
          tok: swap.beatTok,
          blank: 'last',
          apply: (beat) => (swap.beat = beat),
        })
      }
    }
    for (const mark of scene.marks) {
      carriers.push({
        line: mark.line,
        tok: mark.beatTok,
        blank: 'last',
        apply: (beat, end) => {
          mark.beat = beat
          mark.beatEnd = end
        },
      })
    }
    for (const morph of scene.morphs) {
      carriers.push({
        line: morph.line,
        tok: morph.beatTok,
        blank: 'last',
        apply: (beat) => (morph.beat = beat),
      })
    }

    carriers.sort((a, b) => a.line - b.line)
    for (const carrier of carriers) {
      const got = resolve(carrier.tok, carrier.line)
      if (got) {
        carrier.apply(got.beat, got.end, got.shared, got.held)
        last = got.beat
      } else if (carrier.tok != null || carrier.blank === 'last') {
        // Either a phrase that missed — reported already — or a line with no
        // beat at all. Both belong where the author was, not at beat zero.
        carrier.apply(last, 0, false, false)
      }
    }

    // An unanchored shape sits between its anchored neighbours, which is what
    // makes anchoring every line unnecessary — unless it is being *arranged*
    // rather than sequenced. The three sides of a `group`, or the two halves of
    // a `compare`, are one arrival: giving them consecutive beats would deal
    // them out one at a time, which is the opposite of what the author asked
    // for by putting them in the same box.
    const together = new Set<SlateNode>()
    for (const [node, parent] of holder) {
      if (!parent || node.beatTok != null) continue
      if (parent.kind === 'compare' || parent.kind === 'group') together.add(node)
      else if ((LAYOUT_KINDS as readonly string[]).includes(parent.kind)) together.add(node)
    }

    const flat: SlateNode[] = []
    const push = (node: SlateNode) => {
      if (!together.has(node)) flat.push(node)
      for (const child of node.children) push(child)
    }
    for (const row of scene.rows) for (const node of row) push(node)
    for (const swap of scene.swaps) if (swap.node) push(swap.node)
    flat.sort((a, b) => a.line - b.line)

    let previous = 0
    flat.forEach((node, i) => {
      if (node.beat === 0 && node.beatTok == null) {
        let next: number | null = null
        for (let j = i + 1; j < flat.length; j++) {
          if (flat[j].beat) {
            next = flat[j].beat
            break
          }
        }
        node.beat =
          next != null ? Math.max(previous, Math.min(next, previous + 1)) : Math.max(previous, 1)
      }
      previous = node.beat
    })

    const fill = (node: SlateNode) => {
      for (const row of node.rows) if (!row.beat) row.beat = node.beat
      for (const arm of node.arms) if (!arm.beat) arm.beat = node.beat
      for (const child of node.children) {
        if (together.has(child)) child.beat = node.beat
        fill(child)
      }
    }
    for (const row of scene.rows) for (const node of row) fill(node)
    for (const swap of scene.swaps) {
      if (swap.node) swap.beat = swap.node.beat
    }
  }
}

/** Every node in a scene, containers, contents and replacements alike. */
export function allNodes(scene: SlateScene): SlateNode[] {
  const out: SlateNode[] = []
  const push = (node: SlateNode) => {
    out.push(node)
    for (const child of node.children) push(child)
  }
  for (const row of scene.rows) for (const node of row) push(node)
  for (const swap of scene.swaps) if (swap.node) push(swap.node)
  return out
}

/**
 * `sym clock : takes time to boot` — the glyph, and what it is there to say.
 *
 * The separator is the one arrows and relations already use, which matters more
 * than it looks: a symbol name can be two words (`memory chip`, `browser
 * window`), so anything positional would have had to guess where the name ends.
 */
export function splitCaption(text: string): [string, string] {
  const at = text.indexOf(' : ')
  if (at < 0) return [text.trim(), '']
  return [text.slice(0, at).trim(), text.slice(at + 3).trim()]
}

/**
 * `#records.3`, `#stack.top` — a mark aimed at one row of a block.
 *
 * The language documented this from the start and nothing implemented it: the
 * renderer looked up the whole name, found nothing, and drew no mark at all.
 * Which is the exact failure Slate was built to end, sitting in Slate.
 */
export function splitTarget(target: string): { name: string; part: string | null } {
  const dot = target.indexOf('.')
  if (dot < 0) return { name: target, part: null }
  return { name: target.slice(0, dot), part: target.slice(dot + 1).toLowerCase() }
}

/** Which row of a block a `.part` means, or -1 if it means none of them. */
export function rowIndex(part: string, count: number): number {
  if (part === 'top' || part === 'first') return 0
  if (part === 'bottom' || part === 'last') return count - 1
  const n = Number(part)
  return Number.isInteger(n) && n >= 1 && n <= count ? n - 1 : -1
}

/** Every name a scene can be pointed at: its own shapes, and what it carried. */
export function namesIn(scene: SlateScene): Set<string> {
  return new Set(
    allNodes(scene)
      .filter((node) => node.name)
      .map((node) => node.name!)
      .concat(scene.carries)
  )
}
