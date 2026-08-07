/**
 * Slate — a line-based language for boards, timed to narration.
 *
 * Chalk with the guesswork taken out. The one change everything else follows
 * from: an anchor is a beat NUMBER, not a phrase hunted for in prose. A Chalk
 * anchor that missed still drew its shape, just on the wrong beat, and nothing
 * said so. A beat number cannot half-work — it is either in range or it is a
 * build error.
 *
 * See docs/slate.md for the language. This file is the parser and the timing;
 * lib/slate-lint.ts is what refuses to build.
 */

/** Containers: five kinds, each meaning something the others do not. */
export const CONTAINERS = ['box', 'actor', 'step', 'choice', 'store'] as const
/** Structures with a block form — one beat per row. */
export const BLOCKS = ['stk', 'arr', 'tbl', 'chart'] as const

export const COLOURS = ['blue', 'green', 'red', 'violet', 'yellow', 'orange', 'grey'] as const
export type Colour = (typeof COLOURS)[number]

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
  beatTok: string | null
  /** Resolved beat, 1-based within the scene. */
  beat: number
  /** `|3*` — this beat is deliberately shared with another shape. */
  shared: boolean
  children: SlateNode[]
  rows: SlateRow[]
  /** Arrow ends, in order. A chain has more than two. */
  names?: string[]
  style?: '->' | '-->' | '<->'
  line: number
}

export interface SlateRow {
  text?: string
  cells?: string[]
  header?: boolean
  beatTok: string | null
  beat: number
  line: number
}

export interface SlateMark {
  kind: 'hl' | 'ring' | 'dim' | 'note'
  target: string
  text?: string
  beatTok: string | null
  beat: number
  line: number
}

export interface SlateScene {
  n: number
  /** One sentence a beat, numbered from one. */
  beats: string[]
  rows: SlateNode[][]
  marks: SlateMark[]
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
  scenes: SlateScene[]
  problems: SlateProblem[]
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
  if (/^(\d+[*+]?|\+)$/.test(token) || /^[A-Za-z0-9"'(].{1,80}$/.test(token)) {
    return [text.slice(0, bar).trim(), token]
  }
  return [text, null]
}

/** `kind #name TEXT [stat] ~role |beat` — everything after the kind optional. */
function parseShapeLine(line: string, lineNo: number): SlateNode {
  let rest = line.trim()
  const kind = rest.split(/\s+/)[0]
  rest = rest.slice(kind.length).trim()

  let beatTok: string | null = null
  ;[rest, beatTok] = stripBeat(rest)

  let role: string | null = null
  let colour: string | null = null
  rest = rest.replace(/(?:^|\s)~([a-zA-Z][\w-]*)/, (_, r: string) => {
    role = r
    return ' '
  })
  rest = rest.replace(/(?:^|\s)@([a-z]+)/, (_, c: string) => {
    colour = c
    return ' '
  })

  let stat: string | null = null
  rest = rest.replace(/\[([^\]]*)\]/, (_, s: string) => {
    stat = s.trim()
    return ' '
  })

  let name: string | null = null
  const named = rest.match(/^#(\S+)\s*/)
  if (named) {
    name = named[1]
    rest = rest.slice(named[0].length)
  }

  return {
    kind,
    name,
    text: rest.replace(/\s{2,}/g, ' ').trim(),
    stat,
    role,
    colour,
    beatTok,
    beat: 0,
    shared: false,
    children: [],
    rows: [],
    line: lineNo,
  }
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
  const lesson: SlateLesson = { title: '', sub: '', roles: {}, scenes: [], problems: [] }
  let scene: SlateScene | null = null
  let row: SlateNode[] | null = null
  let stack: SlateNode[] = []

  const openScene = (n: number) => {
    scene = {
      n,
      beats: (scriptScenes.get(n) ?? []).slice(),
      rows: [],
      marks: [],
      carries: [],
      shapes: [],
    }
    lesson.scenes.push(scene)
    row = null
    stack = []
  }

  source.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.replace(/\t/g, '  ')
    const trimmed = line.trim()
    const lineNo = index + 1

    // A blank line ends a row, and with it any open container.
    if (!trimmed) {
      row = null
      stack = []
      return
    }
    if (/^(#|\/\/)\s/.test(trimmed)) return

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
    if (/^-{3,}/.test(trimmed) && !/^->/.test(trimmed)) {
      const heading = trimmed.match(/^-{3,}\s*(?:SCENE\s*)?(\d+)?/i)
      openScene(heading?.[1] ? Number(heading[1]) : lesson.scenes.length + 1)
      return
    }
    if (!scene) openScene(1)
    const here = scene as SlateScene

    if (/^say\s+/i.test(trimmed)) {
      here.beats.push(trimmed.replace(/^say\s+/i, ''))
      return
    }

    const indent = Math.floor((line.match(/^ */)?.[0].length ?? 0) / 2)

    const arrow = trimmed.match(/^(-->|->|<->)\s+(.+)$/)
    if (arrow) {
      let rest = arrow[2]
      let beatTok: string | null = null
      ;[rest, beatTok] = stripBeat(rest)
      const [ends, ...label] = rest.split(/\s+:\s+/)
      const node: SlateNode = {
        kind: 'arrow',
        style: arrow[1] as SlateNode['style'],
        names: ends.trim().split(/\s+/),
        name: null,
        text: label.join(' : ').trim(),
        stat: null,
        role: null,
        colour: null,
        beatTok,
        beat: 0,
        shared: false,
        children: [],
        rows: [],
        line: lineNo,
      }
      if (!row) {
        row = []
        here.rows.push(row)
      }
      row.push(node)
      here.shapes.push(node)
      return
    }

    const marked = trimmed.match(/^(hl|ring|dim)\s+#(\S+)\s*(.*)$/)
    if (marked) {
      const [, kind, target, tail] = marked
      const [, beatTok] = stripBeat('x ' + tail)
      here.marks.push({
        kind: kind as SlateMark['kind'],
        target,
        beatTok,
        beat: 0,
        line: lineNo,
      })
      return
    }

    const noted = trimmed.match(/^note\s+#(\S+)\s+(.+)$/)
    if (noted) {
      let rest = noted[2]
      let beatTok: string | null = null
      ;[rest, beatTok] = stripBeat(rest)
      here.marks.push({ kind: 'note', target: noted[1], text: rest, beatTok, beat: 0, line: lineNo })
      return
    }

    if (/^(carry|recall)\s+/.test(trimmed)) {
      for (const token of trimmed.replace(/^(carry|recall)\s+/, '').split(/\s+/)) {
        here.carries.push(token.replace(/^#/, ''))
      }
      return
    }

    const parent = indent > 0 ? stack[indent - 1] : null

    // Inside a block, a line is a row rather than a shape: no kind token, and
    // its own beat, which is the whole reason blocks have a block form.
    if (parent && (BLOCKS as readonly string[]).includes(parent.kind)) {
      if (parent.kind === 'tbl') {
        const cells = trimmed.split('|').map((c) => c.trim())
        let beatTok: string | null = null
        const last = cells[cells.length - 1]
        if (/^(\d+[*+]?|\+)$/.test(last)) {
          beatTok = last
          cells.pop()
        }
        const header = cells[0].startsWith(':')
        if (header) cells[0] = cells[0].replace(/^:\s*/, '')
        parent.rows.push({ cells, header, beatTok, beat: 0, line: lineNo })
      } else {
        const [text, beatTok] = stripBeat(trimmed)
        parent.rows.push({ text, beatTok, beat: 0, line: lineNo })
      }
      return
    }

    const node = parseShapeLine(trimmed, lineNo)
    here.shapes.push(node)

    if (parent && (CONTAINERS as readonly string[]).includes(parent.kind)) parent.children.push(node)
    else {
      if (!row) {
        row = []
        here.rows.push(row)
      }
      row.push(node)
    }
    stack[indent] = node
    stack.length = indent + 1
  })

  resolveBeats(lesson)
  return lesson
}

/**
 * Turns every beat token into a number, and reports the ones that cannot be.
 *
 * `|3` is a beat, `|+` is the one after the last anchored shape, `|3*` says a
 * shared beat was meant, and a bare phrase is still accepted — matched against
 * the narration the way Chalk did, but a miss is an error rather than a shrug.
 */
function resolveBeats(lesson: SlateLesson) {
  for (const scene of lesson.scenes) {
    const total = scene.beats.length
    let last = 0

    const norm = (s: string) =>
      s.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()
    const beats = scene.beats.map(norm)

    const resolve = (token: string | null, line: number): number | null => {
      if (token == null) return null
      if (token === '+') return Math.min(last + 1, Math.max(total, 1))

      const numeric = token.match(/^(\d+)([*+]?)$/)
      if (numeric) {
        const n = Number(numeric[1])
        if (total && n > total) {
          lesson.problems.push({
            level: 'err',
            line,
            msg: `beat |${n} is past the last beat (${total}) of scene ${scene.n}`,
          })
        }
        return n
      }

      const found = beats.findIndex((beat) => beat.includes(norm(token)))
      if (found < 0) {
        lesson.problems.push({
          level: 'err',
          line,
          msg: `anchor “${token}” is not in scene ${scene.n}'s narration`,
        })
        return null
      }
      return found + 1
    }

    const walk = (node: SlateNode) => {
      const beat = resolve(node.beatTok, node.line)
      if (beat != null) {
        node.beat = beat
        last = beat
      } else {
        node.beat = node.beatTok == null ? 0 : last
      }
      node.shared = /\*$/.test(node.beatTok ?? '')

      for (const child of node.children) walk(child)
      for (const row of node.rows) {
        const rowBeat = resolve(row.beatTok, row.line)
        if (rowBeat != null) {
          row.beat = rowBeat
          last = rowBeat
        } else {
          row.beat = 0
        }
      }
    }

    // In written order, because `|+` means "the next one after the last".
    for (const row of scene.rows) for (const node of row) walk(node)
    for (const mark of scene.marks) {
      const beat = resolve(mark.beatTok, mark.line)
      mark.beat = beat != null ? beat : last
    }

    // An unanchored shape sits between its anchored neighbours, which is what
    // makes anchoring every line unnecessary.
    const flat: SlateNode[] = []
    const push = (node: SlateNode) => {
      flat.push(node)
      for (const child of node.children) push(child)
    }
    for (const row of scene.rows) for (const node of row) push(node)

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
        node.beat = next != null ? Math.max(previous, Math.min(next, previous + 1)) : Math.max(previous, 1)
      }
      previous = node.beat
    })

    const fill = (node: SlateNode) => {
      for (const row of node.rows) if (!row.beat) row.beat = node.beat
      for (const child of node.children) fill(child)
    }
    for (const row of scene.rows) for (const node of row) fill(node)
  }
}

/** Every node in a scene, containers and their contents alike. */
export function allNodes(scene: SlateScene): SlateNode[] {
  const out: SlateNode[] = []
  const push = (node: SlateNode) => {
    out.push(node)
    for (const child of node.children) push(child)
  }
  for (const row of scene.rows) for (const node of row) push(node)
  return out
}
