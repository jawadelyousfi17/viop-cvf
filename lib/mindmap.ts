import type { BoardColor, BoardShape, Scene } from './lesson'

/**
 * Mindmaps: a root idea and everything that hangs off it, to any depth.
 *
 * The same division of labour as the Mermaid flowcharts in lib/mermaid.ts — the
 * model says what belongs under what, and the layout is decided here. A mindmap
 * is a stricter shape than a flowchart, though: it is a tree, it is read
 * outward from the middle, and the branches balance either side of the root.
 * That structure is exactly what a model laying out coordinates by hand
 * destroys, so it never gets the chance.
 *
 * The map has no fixed depth and no fixed size. A leaf is not the end of the
 * map, it is the part of it nobody has asked about yet: click one and its own
 * branches are written and grafted on where it stands. So the layout is a tidy
 * tree — every node's children stacked beside it, every subtree given exactly
 * the room it needs — rather than the three hard-coded rings a mindmap usually
 * gets. Nothing here clamps to a board: the drawing is as big as the tree is,
 * and the camera in components/engine is what makes that viewable.
 *
 * A map is silent. It is read, not listened to, so it carries no narration and
 * no shape has an `anchor` — an anchor exists to pin a shape to a spoken word.
 */

export interface MindNode {
  /** The label on the board. Short — a few words. */
  text: string
  /**
   * A sentence or two, drawn under the label in a lighter hand.
   *
   * The far edge of the map is where the explaining happens: by the time
   * someone has clicked three levels down they have stopped scanning a
   * structure and started reading about one thing, and a six-word chip is no
   * longer an answer. Nodes near the middle leave this empty — a map whose
   * every node is a paragraph is a document.
   */
  detail?: string
  /** One common noun, drawn as line art beside the node. */
  symbol?: string
  children: MindNode[]
}

export interface MindMap {
  heading: string
  root: MindNode
}

/** Ceilings, so a model that ignores the prompt makes a crowded map, not chaos. */
const MAX_CHILDREN = 8
const MAX_LABEL = 80
const MAX_DETAIL = 260
/** How deep the layout will draw. Deeper nodes are kept, just not shown. */
const MAX_DEPTH = 8

// Column widths per depth: the root is a plate, a branch is a box, everything
// further out is lettering. Narrower as you go out, because depth is what the
// map spends its width on.
const ROOT_W = 340
const ROOT_H = 150
const BRANCH_W = 300
const BRANCH_MIN_H = 92
const LEAF_W = 260
const LEAF_MIN_H = 64
/** Horizontal air between a node and its children. */
const COL_GAP = 96
/** Vertical air between siblings, and between the parts of one node's cell. */
const ROW_GAP = 26
const STACK_GAP = 12
/** A node's symbol, and the air under it. */
const SYMBOL = 90
const SYMBOL_GAP = 12
/** Room above the map for its title. */
const HEADING_H = 120
/** Widest a node's explanation is set. */
const DETAIL_W = 320

/** One colour per limb, so a branch and everything under it read as one thing. */
const LIMB_COLORS: BoardColor[] = [
  'blue',
  'violet',
  'green',
  'orange',
  'red',
  'light-blue',
  'light-green',
  'light-violet',
]

/** Type sizes, kept in step with components/engine/palette.ts. */
const TYPE = { s: 19, m: 25, l: 34 } as const
/** Roughly what a character costs in the board's hand, per point of type. */
const CHAR = 0.54

/* ------------------------------------------------------------------ ids --- */

/**
 * A node's id is its path from the root: `n`, `n.0`, `n.0.3`.
 *
 * Which means the board hands back a full address when a shape is clicked —
 * there is no lookup table to keep in step with the tree, and grafting children
 * onto `n.0.3` is a walk down two indices.
 */
export const ROOT_ID = 'n'

export function childId(parent: string, index: number) {
  return `${parent}.${index}`
}

/** The node at an id, or null when the path no longer leads anywhere. */
export function nodeAt(root: MindNode, id: string): MindNode | null {
  let node: MindNode | undefined = root
  for (const step of id.split('.').slice(1)) {
    node = node?.children[Number(step)]
    if (!node) return null
  }
  return node ?? null
}

/** The labels from the root down to a node — the context an expansion needs. */
export function trailTo(root: MindNode, id: string): string[] {
  const trail = [root.text]
  let node = root
  for (const step of id.split('.').slice(1)) {
    const next = node.children[Number(step)]
    if (!next) break
    trail.push(next.text)
    node = next
  }
  return trail
}

/** The tree with one node's children replaced. Structural sharing, no mutation. */
export function graft(root: MindNode, id: string, children: MindNode[]): MindNode {
  const steps = id.split('.').slice(1).map(Number)

  const walk = (node: MindNode, depth: number): MindNode => {
    if (depth === steps.length) return { ...node, children }
    const child = node.children[steps[depth]]
    if (!child) return node
    const next = [...node.children]
    next[steps[depth]] = walk(child, depth + 1)
    return { ...node, children: next }
  }

  return walk(root, 0)
}

/* --------------------------------------------------------------- parsing --- */

/**
 * Reads an indented outline into a tree.
 *
 * Accepts what a person or a model would write without being told a syntax:
 * Mermaid's `mindmap` block, a markdown bullet list, or bare indented lines.
 * Indentation is the only structure that matters — bullets, Mermaid's node
 * brackets and surrounding quotes are noise and are stripped.
 *
 * Two pieces of syntax of its own: a trailing `@word` asks for a symbol beside
 * the node, and anything after ` -- ` is that node's longer explanation.
 */
export function parseOutline(source: string): MindNode | null {
  if (!source?.trim()) return null

  const rows: { depth: number; node: MindNode }[] = []

  for (const raw of source.replace(/\r/g, '').split('\n').slice(0, 200)) {
    if (!raw.trim()) continue
    // A tab is worth two spaces; anything else and one file's tabs outrank
    // another file's four-space indents.
    const expanded = raw.replace(/\t/g, '  ')
    const indent = expanded.length - expanded.trimStart().length
    const node = readLine(expanded.trim())
    if (!node || /^mindmap\b/i.test(node.text)) continue
    rows.push({ depth: indent, node })
  }

  if (!rows.length) return null

  // The first line is the root whatever its indentation, and the rest are
  // ranked against it. An outline written with no root line at all still
  // becomes a map rather than a root with everything buried under one child.
  const [first, ...rest] = rows
  const stack: { depth: number; node: MindNode }[] = [first]

  for (const row of rest) {
    while (stack.length > 1 && row.depth <= stack[stack.length - 1].depth) stack.pop()
    stack[stack.length - 1].node.children.push(row.node)
    stack.push(row)
  }

  return first.node
}

/** One outline line: its label, its symbol and its explanation. */
function readLine(line: string): MindNode | null {
  let text = line.replace(/^[-*+•]\s*/, '').trim()

  let detail = ''
  const explained = text.split(' -- ')
  if (explained.length > 1) {
    text = explained[0].trim()
    detail = explained.slice(1).join(' -- ').trim().slice(0, MAX_DETAIL)
  }

  let symbol = ''
  const asked = /\s@([\w -]{1,40})$/.exec(text)
  if (asked) {
    symbol = asked[1].trim()
    text = text.slice(0, asked.index).trim()
  }

  // `root((Cache))`, `id[Label]`, `id{Label}` — the id carries no meaning in a
  // mindmap, where nothing cross-references anything.
  const bracketed =
    /^[\w.-]*\s*(\(\(|\[\[|\(\[|\[|\(|\{\{|\{)(.*?)(\)\)|\]\]|\]\)|\]|\)|\}\}|\})$/.exec(text)
  if (bracketed) text = bracketed[2].trim()
  if (/^".*"$/.test(text) || /^'.*'$/.test(text)) text = text.slice(1, -1).trim()

  text = text.slice(0, MAX_LABEL)
  if (!text) return null

  return { text, children: [], ...(detail ? { detail } : {}), ...(symbol ? { symbol } : {}) }
}

/**
 * A tree back out as an outline, in the same syntax `parseOutline` reads.
 *
 * Which makes export and import the same format: what comes out of a map can be
 * edited in a text editor and handed straight back. There is no separate export
 * schema to keep in step with the one people actually type.
 */
export function toOutline(root: MindNode): string {
  const lines: string[] = []

  const walk = (node: MindNode, depth: number) => {
    const symbol = node.symbol ? ` @${node.symbol}` : ''
    const detail = node.detail ? ` -- ${node.detail}` : ''
    lines.push(`${'  '.repeat(depth)}${node.text}${symbol}${detail}`)
    for (const child of node.children) walk(child, depth + 1)
  }

  walk(root, 0)
  return lines.join('\n')
}

/* ---------------------------------------------------------------- layout --- */

interface Cell {
  node: MindNode
  id: string
  depth: number
  /** The node's own box. */
  w: number
  h: number
  /** The whole stack: symbol above, node, explanation below. */
  cellW: number
  cellH: number
  detailH: number
  /** How much vertical room this node and everything under it needs. */
  extent: number
  children: Cell[]
  pending: boolean
  hidden: number
}

export interface LayoutOptions {
  id?: string
  /** Nodes whose children are put away. */
  folded?: ReadonlySet<string>
  /** Nodes with a request in flight, drawn as waiting. */
  pending?: ReadonlySet<string>
}

/**
 * Lays a tree out as a scene the board can draw as-is.
 *
 * Classic two-sided arrangement: the root in the middle, the first half of its
 * branches down the right, the rest down the left, and every level beyond
 * stacked further out on the same side as the limb it belongs to. Each node
 * owns a band exactly as tall as its subtree needs, which is what keeps a map
 * with one deep limb and three shallow ones from listing to one side.
 */
export function mindmapToScene(map: MindMap, options: LayoutOptions = {}): Scene | null {
  const { id = 'mindmap', folded, pending } = options
  const root = clean(map.root)
  if (!root) return null

  const measured = measure(root, ROOT_ID, 0, folded, pending)
  const shapes: BoardShape[] = []

  // The root is placed against its own height, not its subtree's. `place`
  // centres a node inside the band it is given, and the root's band is the
  // whole map — centring it there would drop it to the bottom of the drawing
  // while its limbs, which are centred on the root's own box, stayed at the
  // top.
  place({ ...measured, extent: measured.cellH }, shapes, 0, 0, 'black', 0)

  // Split the root's children where the two columns come out closest in
  // height. Splitting by count is what makes a map lopsided: three thin limbs
  // and two deep ones are the same number and nowhere near the same height.
  const half = splitPoint(measured.children)
  const sides: { cells: Cell[]; dir: 1 | -1; offset: number }[] = [
    { cells: measured.children.slice(0, half), dir: 1, offset: 0 },
    { cells: measured.children.slice(half), dir: -1, offset: half },
  ]

  for (const side of sides) {
    const stack =
      side.cells.reduce((sum, cell) => sum + cell.extent, 0) +
      ROW_GAP * Math.max(0, side.cells.length - 1)
    let y = measured.cellH / 2 - stack / 2

    for (const [i, cell] of side.cells.entries()) {
      const limb = side.offset + i
      const color = LIMB_COLORS[limb % LIMB_COLORS.length]
      const x = side.dir === 1 ? measured.cellW + COL_GAP : -COL_GAP - cell.cellW
      subtree(cell, shapes, x, y, side.dir, color, measured.id)
      y += cell.extent + ROW_GAP
    }
  }

  // The tree was laid out around the root at the origin; shift it so the whole
  // drawing sits in positive space, with room above it for the title.
  const heading = map.heading.trim()
  const titled = Boolean(heading) && heading.toLowerCase() !== root.text.toLowerCase()
  const minX = Math.min(...shapes.map((shape) => shape.x))
  const minY = Math.min(...shapes.map((shape) => shape.y))
  for (const shape of shapes) {
    shape.x += 60 - minX
    shape.y += (titled ? HEADING_H : 40) - minY
  }

  if (titled) {
    shapes.unshift({
      ...base(),
      id: 'heading',
      kind: 'text',
      text: heading,
      x: 60,
      y: 30,
      w: 900,
      h: 54,
      size: 'l',
    })
  }

  return {
    id,
    heading: heading || root.text,
    // Silent by construction: nothing downstream can ask a voice for a map.
    narration: '',
    diagram: { source: '', timing: [] },
    layout: 'fixed',
    shapes,
  }
}

/** Sizes one node and, recursively, everything under it. */
function measure(
  node: MindNode,
  id: string,
  depth: number,
  folded?: ReadonlySet<string>,
  pending?: ReadonlySet<string>
): Cell {
  const isFolded = Boolean(folded?.has(id))

  const w = depth === 0 ? ROOT_W : depth === 1 ? BRANCH_W : LEAF_W
  const size = depth === 0 ? 'l' : depth === 1 ? 'm' : 's'
  const minH = depth === 0 ? ROOT_H : depth === 1 ? BRANCH_MIN_H : LEAF_MIN_H
  const h = Math.max(minH, textHeight(node.text, w, size) + (depth === 0 ? 40 : 26))

  const detailH = node.detail ? textHeight(node.detail, DETAIL_W, 's') + 8 : 0
  const cellW = Math.max(w, detailH ? DETAIL_W : 0)
  const cellH = h + (node.symbol ? SYMBOL + SYMBOL_GAP : 0) + (detailH ? detailH + STACK_GAP : 0)

  const children =
    isFolded || depth >= MAX_DEPTH
      ? []
      : node.children
          .slice(0, MAX_CHILDREN)
          .map((child, i) => measure(child, childId(id, i), depth + 1, folded, pending))

  const stack =
    children.reduce((sum, child) => sum + child.extent, 0) +
    ROW_GAP * Math.max(0, children.length - 1)

  return {
    node,
    id,
    depth,
    w,
    h,
    cellW,
    cellH,
    detailH,
    children,
    pending: Boolean(pending?.has(id)),
    hidden: isFolded ? node.children.length : 0,
    extent: Math.max(cellH, stack),
  }
}

/**
 * Draws one node: its symbol above, the node itself, its explanation below.
 *
 * A node with an explanation has a cell wider than the node, and which edge
 * they line up on matters: flush with the side the parent is on. Centred, the
 * paragraph hangs out into the corridor the connector runs down, and the
 * arrow arrives through the middle of the first line.
 */
function place(
  cell: Cell,
  shapes: BoardShape[],
  x: number,
  y: number,
  color: BoardColor,
  dir: -1 | 0 | 1
) {
  const top = y + cell.extent / 2 - cell.cellH / 2
  const nodeY = top + (cell.node.symbol ? SYMBOL + SYMBOL_GAP : 0)
  const nodeX =
    dir === 1 ? x : dir === -1 ? x + cell.cellW - cell.w : x + (cell.cellW - cell.w) / 2

  if (cell.node.symbol) {
    shapes.push({
      ...base(),
      id: `${cell.id}s`,
      kind: 'symbol',
      text: cell.node.symbol,
      x: nodeX + cell.w / 2 - SYMBOL / 2,
      y: top,
      w: SYMBOL,
      h: SYMBOL,
      color,
    })
  }

  shapes.push({
    ...base(),
    id: cell.id,
    kind: cell.depth === 0 ? 'ellipse' : cell.depth === 1 ? 'box' : 'label',
    // A folded node says how much is under it, so a fold reads as something
    // put away rather than something missing; a node being written says so.
    text: cell.pending
      ? `${cell.node.text} …`
      : cell.hidden
        ? `${cell.node.text}  +${cell.hidden}`
        : cell.node.text,
    x: nodeX,
    y: nodeY,
    w: cell.w,
    h: cell.h,
    color,
    // Washed rather than outlined: a filled shape with a solid twin behind it
    // is what makes the lesson boards read as drawn. Lettering further out
    // stays bare — boxing every leaf turns the map into a grid of rectangles.
    fill: cell.depth <= 1 ? 'semi' : 'none',
    size: cell.depth === 0 ? 'l' : cell.depth === 1 ? 'm' : 's',
    dash: cell.pending ? 'dotted' : 'draw',
  })

  if (cell.detailH) {
    shapes.push({
      ...base(),
      id: `${cell.id}d`,
      kind: 'text',
      text: cell.node.detail ?? '',
      x,
      y: nodeY + cell.h + STACK_GAP,
      w: cell.cellW,
      h: cell.detailH,
      color: 'grey',
      size: 's',
    })
  }
}

/** Places a node, then its children further out, and their children beyond. */
function subtree(
  cell: Cell,
  shapes: BoardShape[],
  x: number,
  y: number,
  dir: 1 | -1,
  color: BoardColor,
  parentId: string
) {
  place(cell, shapes, x, y, color, dir)

  shapes.push({
    ...base(),
    id: `${cell.id}~`,
    kind: 'arrow',
    from: parentId,
    to: cell.id,
    color,
    size: 's',
  })

  const stack =
    cell.children.reduce((sum, child) => sum + child.extent, 0) +
    ROW_GAP * Math.max(0, cell.children.length - 1)
  let childY = y + cell.extent / 2 - stack / 2

  for (const child of cell.children) {
    const childX = dir === 1 ? x + cell.cellW + COL_GAP : x - COL_GAP - child.cellW
    subtree(child, shapes, childX, childY, dir, color, cell.id)
    childY += child.extent + ROW_GAP
  }
}

/**
 * Where to cut the root's children between the right side and the left, so the
 * two columns come out closest in height.
 */
function splitPoint(cells: Cell[]) {
  const heights = cells.map((cell) => cell.extent + ROW_GAP)
  const total = heights.reduce((sum, height) => sum + height, 0)

  const even = Math.ceil(cells.length / 2)
  let best = even
  let smallest = Infinity
  let above = 0

  for (let cut = 1; cut <= cells.length; cut++) {
    above += heights[cut - 1]
    const gap = Math.abs(above - (total - above))
    // Ties go to the cut nearest an even one, so equal limbs split down the
    // middle instead of piling onto the right.
    if (gap < smallest || (gap === smallest && Math.abs(cut - even) < Math.abs(best - even))) {
      smallest = gap
      best = cut
    }
  }
  return best
}

/** What a run of text costs vertically at a given width. */
function textHeight(text: string, width: number, size: keyof typeof TYPE) {
  const point = TYPE[size]
  const perLine = Math.max(6, Math.floor((width - 24) / (point * CHAR)))
  const lines = text
    .split('\n')
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / perLine)), 0)
  return lines * point * 1.2
}

/** Drops empty nodes and trims every string to something a board can hold. */
function clean(node: MindNode | null | undefined): MindNode | null {
  if (!node) return null
  const text = String(node.text ?? '').trim().slice(0, MAX_LABEL)
  if (!text) return null

  const detail = String(node.detail ?? '').trim().slice(0, MAX_DETAIL)
  const symbol = String(node.symbol ?? '').trim().slice(0, 40)

  return {
    text,
    ...(detail ? { detail } : {}),
    ...(symbol ? { symbol } : {}),
    children: (node.children ?? [])
      .map((child) => clean(child))
      .filter((child): child is MindNode => Boolean(child)),
  }
}

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

/**
 * Strict JSON schema for the model. Depth is spelled out rather than recursive:
 * strict mode's recursion support differs between the two providers, and the
 * map is only ever asked for two levels at a time — anything deeper arrives
 * later, one expansion at a time.
 */
export const MINDMAP_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['heading', 'root', 'branches'],
  properties: {
    heading: { type: 'string' },
    root: { type: 'string' },
    branches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'symbol', 'children'],
        properties: {
          text: { type: 'string' },
          symbol: { type: 'string' },
          children: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const

/** What comes back when one node is opened up. */
export const EXPAND_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['children'],
  properties: {
    children: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'detail', 'symbol'],
        properties: {
          text: { type: 'string' },
          detail: { type: 'string' },
          symbol: { type: 'string' },
        },
      },
    },
  },
} as const

/** The model's flat answer, as the tree the layout wants. */
export function mindmapFromModel(raw: unknown): MindMap | null {
  const value = raw as { heading?: unknown; root?: unknown; branches?: unknown }
  const rootText = typeof value?.root === 'string' ? value.root.trim() : ''
  if (!rootText) return null

  const branches = (Array.isArray(value.branches) ? value.branches : [])
    .map((branch): MindNode | null => {
      const entry = branch as { text?: unknown; symbol?: unknown; children?: unknown }
      const text = typeof entry?.text === 'string' ? entry.text.trim() : ''
      if (!text) return null

      const children = (Array.isArray(entry.children) ? entry.children : [])
        .filter((child): child is string => typeof child === 'string' && Boolean(child.trim()))
        .map((child) => ({ text: child.trim(), children: [] }))
      const symbol = typeof entry.symbol === 'string' ? entry.symbol.trim() : ''
      return { text, children, ...(symbol ? { symbol } : {}) }
    })
    .filter((branch): branch is MindNode => Boolean(branch))

  if (!branches.length) return null

  return {
    heading: typeof value.heading === 'string' ? value.heading.trim() : rootText,
    root: { text: rootText, children: branches },
  }
}

/**
 * A tree that arrived from outside, made safe to store and draw.
 *
 * The browser posts the whole tree back when a map is saved, so this is an
 * untrusted document: it is walked to a fixed depth with a hard node budget,
 * every string is trimmed to what the board can hold, and anything else on the
 * object is dropped. Returns null when there is nothing usable left.
 */
export function sanitizeTree(raw: unknown, budget = 600): MindNode | null {
  let left = budget

  const walk = (value: unknown, depth: number): MindNode | null => {
    if (!value || typeof value !== 'object' || left <= 0 || depth > MAX_DEPTH + 4) return null
    const node = value as { text?: unknown; detail?: unknown; symbol?: unknown; children?: unknown }

    const text = typeof node.text === 'string' ? node.text.trim().slice(0, MAX_LABEL) : ''
    if (!text) return null
    left--

    const detail = typeof node.detail === 'string' ? node.detail.trim().slice(0, MAX_DETAIL) : ''
    const symbol = typeof node.symbol === 'string' ? node.symbol.trim().slice(0, 40) : ''
    const children = (Array.isArray(node.children) ? node.children : [])
      .slice(0, MAX_CHILDREN)
      .map((child) => walk(child, depth + 1))
      .filter((child): child is MindNode => Boolean(child))

    return { text, ...(detail ? { detail } : {}), ...(symbol ? { symbol } : {}), children }
  }

  return walk(raw, 0)
}

/** How big a map is — for the history list, which shouldn't have to parse it. */
export function treeStats(root: MindNode): { nodes: number; depth: number } {
  let nodes = 0
  let depth = 0

  const walk = (node: MindNode, level: number) => {
    nodes++
    depth = Math.max(depth, level)
    for (const child of node.children) walk(child, level + 1)
  }

  walk(root, 1)
  return { nodes, depth }
}

/** The children of one opened node. */
export function childrenFromModel(raw: unknown): MindNode[] {
  const value = raw as { children?: unknown }
  return (Array.isArray(value?.children) ? value.children : [])
    .map((child): MindNode | null => {
      const entry = child as { text?: unknown; detail?: unknown; symbol?: unknown }
      const text = typeof entry?.text === 'string' ? entry.text.trim() : ''
      if (!text) return null

      const detail = typeof entry.detail === 'string' ? entry.detail.trim() : ''
      const symbol = typeof entry.symbol === 'string' ? entry.symbol.trim() : ''
      return {
        text: text.slice(0, MAX_LABEL),
        children: [],
        ...(detail ? { detail: detail.slice(0, MAX_DETAIL) } : {}),
        ...(symbol ? { symbol } : {}),
      }
    })
    .filter((child): child is MindNode => Boolean(child))
    .slice(0, MAX_CHILDREN)
}
