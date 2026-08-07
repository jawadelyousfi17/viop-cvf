import { parseDocument, isMap, isSeq, isScalar, type Node as YamlNode } from 'yaml'
import {
  RELATIONS,
  blankNode,
  isKind,
  normaliseLayout,
  resolveBeats,
  splitSentences,
  type Relation,
  type SlateLesson,
  type SlateNode,
  type SlateScene,
} from './slate'

/**
 * Slate, written as YAML.
 *
 * A second front end, not a second language. It builds exactly the same
 * `SlateLesson` the line-based parser builds, which means the linter, the beat
 * resolver, the DOM renderer and the board compiler are all untouched — one
 * abstract board, two ways to write it down.
 *
 * Why bother. The line form is dense and pleasant to write by hand, and it
 * costs about a third of the tokens. What it costs *back* is a page of grammar
 * in the system prompt: `kind #name TEXT [stat] ~role |beat` is a syntax the
 * model has to be taught, and every model that has ever mis-typed it produced a
 * line that parsed as something else. A model already knows YAML. The failure
 * mode moves from "silently parsed as a different shape" to "the document did
 * not parse", which is the trade this whole project keeps making.
 *
 * The shape of a document:
 *
 *     title: What a container actually is
 *     takeaway: A container is a process with a restricted view.
 *     roles: { package: green, problem: red }
 *     symbols: { whale: container }
 *     scenes:
 *       - n: 1
 *         title: What a virtual machine is
 *         beats: 6
 *         board:
 *           - box: Virtual machine
 *             id: vm
 *             role: problem
 *             at: 1
 *             in:
 *               - box: Hypervisor
 *                 at: 2
 *           - focus: vm
 *             at: [2, 4]
 *
 * Every board entry is a one-key map whose key is the kind and whose value is
 * the primary text. Everything else is a named field, so nothing depends on
 * position and a missing field is missing rather than misread.
 */

/** Fields that are not a kind: the modifiers any entry may carry. */
const FIELDS = new Set([
  'id',
  'at',
  'role',
  'colour',
  'color',
  'stat',
  'in',
  'rows',
  'layout',
  'says',
  'text',
  'cells',
  'to',
  'arms',
  'with',
  'header',
])

/** The entry keys that are connectors or commands rather than shapes. */
const MARKS = ['hl', 'ring', 'dim', 'focus', 'show', 'hide', 'note'] as const
const ARROWS: Record<string, SlateNode['style']> = { arrow: '->', dashed: '-->', both: '<->' }

type Dict = Record<string, unknown>

/**
 * A beat, however it was written.
 *
 * `at: 3`, `at: "+"`, `at: "3*"`, `at: [3, 5]` — all of it is handed to the
 * same resolver the line form uses, so a range means the same thing in both and
 * there is only one place where a beat can be wrong.
 */
function beatToken(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) {
    const [from, to] = value
    return to == null ? String(from) : `${from}..${to}`
  }
  const text = String(value).trim()
  return text || null
}

/**
 * Reads a YAML board, against a script that may already be written.
 *
 * Narration can come from either side, exactly as in the line form: a `say`
 * list in the document, or a separate script keyed by scene number.
 */
export function parseYamlLesson(
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

  const doc = parseDocument(source, { keepSourceTokens: false })
  // YAML's own complaints come first and in its own words. There is no point
  // reporting "scene 3 has no beats" about a document that never parsed.
  for (const error of doc.errors) {
    lesson.problems.push({
      level: 'err',
      line: error.linePos?.[0]?.line,
      msg: `YAML: ${error.message.split('\n')[0]}`,
    })
  }
  if (doc.errors.length) return lesson

  const root = doc.toJS() as Dict | null
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    lesson.problems.push({ level: 'err', msg: 'A board is a mapping with title, roles and scenes.' })
    return lesson
  }

  // Line numbers, so a lint message can point somewhere. Taken from the YAML
  // document's own offsets, which is why the tree is walked twice: `toJS()`
  // gives plain values, the document gives positions.
  const lines = lineIndex(source, doc.contents)

  lesson.title = str(root.title)
  lesson.sub = str(root.takeaway ?? root.summary ?? root.sub)
  for (const [name, colour] of Object.entries(obj(root.roles))) {
    lesson.roles[name] = String(colour).trim()
  }
  for (const [alias, target] of Object.entries(obj(root.symbols))) {
    lesson.symbols[alias.toLowerCase()] = String(target).trim().toLowerCase()
  }

  const scenes = Array.isArray(root.scenes) ? (root.scenes as Dict[]) : []
  if (!scenes.length) {
    lesson.problems.push({ level: 'err', msg: 'No scenes. A board needs a `scenes:` list.' })
  }

  scenes.forEach((raw, index) => {
    const n = typeof raw?.n === 'number' ? raw.n : index + 1
    const scene: SlateScene = {
      n,
      title: str(raw?.title),
      beats: [],
      declared: typeof raw?.beats === 'number' ? raw.beats : 0,
      rows: [],
      marks: [],
      morphs: [],
      swaps: [],
      carries: [],
      shapes: [],
    }

    // The words: a `say` list, a `say` paragraph, or a separate script.
    const said = raw?.say ?? raw?.narration
    if (Array.isArray(said)) scene.beats = said.map((s) => String(s).trim()).filter(Boolean)
    else if (typeof said === 'string') scene.beats = splitSentences(said)
    if (!scene.beats.length) scene.beats = (scriptScenes.get(n) ?? []).slice()

    for (const name of list(raw?.carry ?? raw?.recall)) {
      scene.carries.push(name.replace(/^#/, ''))
    }

    const board = Array.isArray(raw?.board) ? (raw.board as unknown[]) : []
    if (!board.length && !Array.isArray(raw?.board)) {
      lesson.problems.push({
        level: 'err',
        msg: `scene ${n} has no \`board:\` list — nothing will be drawn`,
      })
    }

    // Every top-level entry starts its own row unless it is a connector, which
    // the renderer slots between the shapes it joins. The line form uses blank
    // lines for this; a list needs no such trick, so one entry is one row.
    for (const entry of board) {
      const node = readEntry(lesson, scene, entry as Dict, lines, null)
      if (node) scene.rows.push([node])
    }

    lesson.scenes.push(scene)
  })

  resolveBeats(lesson)
  return lesson
}

/**
 * One board entry: the kind is the key, everything else is a named field.
 *
 * Returns the node when the entry is a shape, and null when it was a mark, a
 * transform or a replacement — those live on the scene, not in a row.
 */
function readEntry(
  lesson: SlateLesson,
  scene: SlateScene,
  entry: Dict,
  lines: Map<string, number>,
  parent: SlateNode | null
): SlateNode | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    lesson.problems.push({ level: 'err', msg: `scene ${scene.n}: a board entry must be a mapping` })
    return null
  }

  const keys = Object.keys(entry).filter((key) => !FIELDS.has(key))
  if (keys.length === 0) {
    lesson.problems.push({
      level: 'err',
      msg: `scene ${scene.n}: an entry with no kind — one of its keys must name what to draw`,
    })
    return null
  }
  // Two kinds in one entry is the one ambiguity YAML introduces that the line
  // form could not express. Saying so is better than picking one.
  if (keys.length > 1) {
    lesson.problems.push({
      level: 'err',
      msg:
        `scene ${scene.n}: entry names ${keys.length} kinds (${keys.join(', ')}) — one entry, one kind. ` +
        `A comma or a colon in unquoted text does this: quote the value.`,
    })
  }

  const kind = keys[0]
  const value = entry[kind]
  const line = lines.get(keyPath(scene.n, kind, value)) ?? 0
  const at = beatToken(entry.at)

  // ---- attention and change: these belong to the scene ---------------------
  if ((MARKS as readonly string[]).includes(kind)) {
    const range = Array.isArray(entry.at) ? entry.at : null
    scene.marks.push({
      kind: kind as (typeof MARKS)[number],
      target: String(value).replace(/^#/, ''),
      text: kind === 'note' ? str(entry.says ?? entry.text) : undefined,
      beatTok: at,
      beat: 0,
      beatEnd: range && range[1] != null ? Number(range[1]) : 0,
      line,
    })
    return null
  }

  if (kind === 'transform') {
    scene.morphs.push({
      target: String(value).replace(/^#/, ''),
      text: str(entry.to),
      stat: entry.stat == null ? null : String(entry.stat),
      role: entry.role == null ? null : String(entry.role),
      beatTok: at,
      beat: 0,
      line,
    })
    return null
  }

  if (kind === 'replace') {
    const into = entry.to
    // `to:` is either the name of a shape already on the board, or the shape
    // itself written inline. Both mean "this stands down for that".
    if (into && typeof into === 'object') {
      const node = readEntry(lesson, scene, into as Dict, lines, null)
      if (node) {
        node.name ??= `${String(value)}-into`
        node.beatTok ??= at
        scene.swaps.push({
          from: String(value).replace(/^#/, ''),
          to: node.name,
          node,
          beatTok: null,
          beat: 0,
          line,
        })
        scene.shapes.push(node)
      }
    } else {
      scene.swaps.push({
        from: String(value).replace(/^#/, ''),
        to: String(into ?? '').replace(/^#/, ''),
        node: null,
        beatTok: at,
        beat: 0,
        line,
      })
    }
    return null
  }

  // ---- connectors ----------------------------------------------------------
  if (kind in ARROWS || (RELATIONS as readonly string[]).includes(kind)) {
    const node = blankNode((RELATIONS as readonly string[]).includes(kind) ? 'rel' : 'arrow', line)
    if (kind in ARROWS) node.style = ARROWS[kind]
    else node.rel = kind as Relation
    node.names = list(value).map((end) => end.replace(/^#/, ''))
    node.text = str(entry.says ?? entry.text)
    node.beatTok = at
    scene.shapes.push(node)
    return node
  }

  // ---- shapes --------------------------------------------------------------
  if (!isKind(kind)) {
    lesson.problems.push({
      level: 'err',
      line,
      msg: `“${kind}” is not a kind — nothing will draw this entry`,
    })
  }

  const node = blankNode(kind === 'col' ? 'column' : kind, line)
  node.name = entry.id == null ? null : String(entry.id).replace(/^#/, '')
  node.role = entry.role == null ? null : String(entry.role)
  node.colour = (entry.colour ?? entry.color) == null ? null : String(entry.colour ?? entry.color)
  node.stat = entry.stat == null ? null : String(entry.stat)
  node.beatTok = at
  if (entry.layout) node.layout = normaliseLayout(String(entry.layout))

  // A symbol's caption rides in `says:`, which the shared splitter then reads
  // back out — so one representation reaches the renderer whichever front end
  // produced it.
  const caption = str(entry.says)
  const primary = Array.isArray(value) ? '' : str(value)
  node.text = caption ? `${primary} : ${caption}` : primary

  // A block has two forms in both front ends, and they must mean the same
  // thing in each. `arr: [42, 17, 8]` is the compact one — one shape, one beat
  // — so it becomes text, exactly as `arr 42, 17, 8` does. An explicit `rows:`
  // is the block form, where every row carries its own beat.
  if (Array.isArray(value)) node.text = joinCompact(node.kind, value as unknown[])
  if (Array.isArray(entry.rows)) readRows(node, entry.rows as unknown[], line)

  for (const arm of Array.isArray(entry.arms) ? (entry.arms as Dict[]) : []) {
    const [label] = Object.keys(arm ?? {}).filter((key) => !FIELDS.has(key))
    if (!label) continue
    node.arms.push({
      label,
      target: String(arm[label]).replace(/^#/, ''),
      beatTok: beatToken(arm.at),
      beat: 0,
      line,
    })
  }

  for (const child of Array.isArray(entry.in) ? (entry.in as unknown[]) : []) {
    const kid = readEntry(lesson, scene, child as Dict, lines, node)
    if (kid) node.children.push(kid)
  }

  scene.shapes.push(node)
  if (parent) return node
  return node
}

/** A list value in the compact form, written the way the line form writes it. */
function joinCompact(kind: string, values: unknown[]): string {
  if (kind === 'tbl') {
    return values
      .map((row) => (Array.isArray(row) ? row.map(String).join(', ') : String(row)))
      .join(' / ')
  }
  // `stk` stacks its layers on separate lines; `arr` lays its cells in a row.
  return values.map(String).join(kind === 'stk' ? ' / ' : ', ')
}

/** The rows of a block: plain values, or `[cells…]` for a table. */
function readRows(node: SlateNode, rows: unknown[], line: number) {
  for (const row of rows) {
    if (Array.isArray(row)) {
      node.rows.push({
        cells: row.map((cell) => String(cell)),
        header: false,
        beatTok: null,
        beat: 0,
        beatEnd: 0,
        line,
      })
      continue
    }
    if (row && typeof row === 'object') {
      const entry = row as Dict
      const cells = entry.cells ?? (Array.isArray(entry.text) ? entry.text : null)
      node.rows.push({
        ...(Array.isArray(cells)
          ? { cells: (cells as unknown[]).map(String) }
          : { text: str(entry.text ?? entry.says) }),
        header: entry.header === true,
        beatTok: beatToken(entry.at),
        beat: 0,
        beatEnd: 0,
        line,
      })
      continue
    }
    node.rows.push({ text: String(row), beatTok: null, beat: 0, beatEnd: 0, line })
  }
}

/**
 * Source lines for the entries, keyed by scene and kind.
 *
 * Approximate on purpose: YAML gives byte offsets and the linter wants line
 * numbers, and matching every entry back to its offset exactly would mean
 * walking the document in parallel with `toJS()`. What matters is that a
 * message lands in the right region of a long file.
 */
function lineIndex(source: string, contents: YamlNode | null): Map<string, number> {
  const index = new Map<string, number>()
  if (!contents) return index

  const starts: number[] = [0]
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1)
  const lineAt = (offset: number) => {
    let low = 0
    let high = starts.length - 1
    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      if (starts[mid] <= offset) low = mid
      else high = mid - 1
    }
    return low + 1
  }

  let scene = 0
  const walk = (node: unknown) => {
    if (isSeq(node)) {
      for (const item of node.items) walk(item)
      return
    }
    if (!isMap(node)) return

    const numbered = node.items.find((pair) => isScalar(pair.key) && pair.key.value === 'n')
    if (numbered && isScalar(numbered.value)) scene = Number(numbered.value.value) || scene

    for (const pair of node.items) {
      if (!isScalar(pair.key)) continue
      const key = String(pair.key.value)
      const range = (pair.key as { range?: readonly number[] }).range
      if (range && !FIELDS.has(key)) {
        const value = isScalar(pair.value) ? pair.value.value : ''
        index.set(keyPath(scene, key, value), lineAt(range[0]))
      }
      walk(pair.value)
    }
  }
  walk(contents)
  return index
}

const keyPath = (scene: number, kind: string, value: unknown) =>
  `${scene}:${kind}:${Array.isArray(value) ? '' : String(value ?? '').slice(0, 40)}`

/** True when a document is YAML rather than the line form. */
export function looksLikeYaml(source: string): boolean {
  const head = source.trimStart()
  if (head.startsWith('=') || head.startsWith('---\n') || /^---\s*\d/.test(head)) return false
  return /^(title|scenes|takeaway|roles|symbols)\s*:/m.test(head)
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function list(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean)
  return String(value).split(/[\s,]+/).map((v) => v.trim()).filter(Boolean)
}
