import dagre from '@dagrejs/dagre'

/**
 * Mermaid flowcharts, parsed and laid out into board shapes.
 *
 * This is the trick Excalidraw's diagram generator uses, and the reason its
 * output looks composed rather than guessed: the model writes a language it
 * has seen a million times instead of a bespoke JSON schema it has never seen,
 * and a real graph layout engine decides where the nodes go. Neither the
 * structure nor the positions are the model's problem any more — it only has
 * to say what connects to what.
 *
 * A deliberate subset of the syntax: node shapes, edges, edge labels and the
 * direction. Subgraphs, styling and the other chart types are not accepted,
 * because everything here has to map onto a shape the board can already draw.
 */

export type NodeShape = 'box' | 'oval' | 'ellipse' | 'diamond' | 'hexagon' | 'arrowright'

export interface MermaidNode {
  id: string
  label: string
  shape: NodeShape
  /** Top-left, relative to the diagram's own box. Filled in by layout. */
  x: number
  y: number
  w: number
  h: number
}

export interface MermaidEdge {
  from: string
  to: string
  label: string
  dashed: boolean
}

export interface MermaidGraph {
  nodes: MermaidNode[]
  edges: MermaidEdge[]
  width: number
  height: number
  /** How far the graph had to be shrunk to fit, 1 when it fitted as drawn. */
  scale: number
}

/** The bracket pairs Mermaid uses to mean a shape, longest first so `((` wins. */
const SHAPES: { open: string; close: string; shape: NodeShape }[] = [
  { open: '((', close: '))', shape: 'ellipse' },
  { open: '{{', close: '}}', shape: 'hexagon' },
  { open: '([', close: '])', shape: 'oval' },
  { open: '[[', close: ']]', shape: 'box' },
  { open: '[', close: ']', shape: 'box' },
  { open: '(', close: ')', shape: 'oval' },
  { open: '{', close: '}', shape: 'diamond' },
  { open: '>', close: ']', shape: 'arrowright' },
]

/** `A[Label]`, `B{Choice}` or a bare `C` — returns the id and, if given, the shape. */
function readNode(text: string): { id: string; label: string; shape: NodeShape } | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  for (const { open, close, shape } of SHAPES) {
    const start = trimmed.indexOf(open)
    if (start <= 0 || !trimmed.endsWith(close)) continue
    const id = trimmed.slice(0, start).trim()
    const label = trimmed.slice(start + open.length, trimmed.length - close.length).trim()
    if (!/^[\w.-]+$/.test(id)) continue
    return { id, label: unquote(label), shape }
  }

  if (!/^[\w.-]+$/.test(trimmed)) return null
  return { id: trimmed, label: trimmed, shape: 'box' }
}

function unquote(value: string) {
  const trimmed = value.trim()
  return /^".*"$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed
}

/** Every arrow form we accept, longest first so `-.->` beats `-`. */
const ARROWS = ['<-->', '-.->', '==>', '-->', '---', '-.-', '===']

/** Splits a statement on its arrow, if it has one. */
function splitEdge(line: string) {
  for (const arrow of ARROWS) {
    // The label form is `A -->|yes| B`, so search past any bracketed text.
    const at = indexOutsideBrackets(line, arrow)
    if (at !== -1) {
      return {
        left: line.slice(0, at),
        right: line.slice(at + arrow.length),
        dashed: arrow.includes('.'),
      }
    }
  }
  return null
}

/** Finds `needle` while ignoring anything inside [] () {} or a quoted string. */
function indexOutsideBrackets(text: string, needle: string) {
  let depth = 0
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') quoted = !quoted
    if (quoted) continue
    if (char === '[' || char === '(' || char === '{') depth++
    else if (char === ']' || char === ')' || char === '}') depth = Math.max(0, depth - 1)
    else if (depth === 0 && text.startsWith(needle, i)) return i
  }
  return -1
}

const NODE_W = 300
const NODE_H = 130
/** Roughly what a character costs at the board's default label size. */
const CHAR_W = 13

function sizeFor(label: string): { w: number; h: number } {
  const longest = Math.max(...label.split('\n').map((line) => line.length), 1)
  const w = Math.min(460, Math.max(NODE_W, longest * CHAR_W + 60))
  const lines = Math.max(1, Math.ceil((longest * CHAR_W) / (w - 60)))
  return { w, h: Math.max(NODE_H, lines * 40 + 70) }
}

/**
 * Parses a Mermaid flowchart and lays it out. Returns null when there is
 * nothing usable in it — a scene should lose its diagram, not fail.
 */
export function parseMermaid(
  source: string,
  fit: { maxW: number; maxH: number } = { maxW: 1326, maxH: 430 }
): MermaidGraph | null {
  if (!source?.trim()) return null

  const nodes = new Map<string, { label: string; shape: NodeShape }>()
  const edges: MermaidEdge[] = []
  let rankdir = 'TB'

  const lines = source
    .replace(/\r/g, '')
    .split(/[\n;]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 60)

  for (const line of lines) {
    const header = /^(?:flowchart|graph)\s+(TB|TD|BT|LR|RL)\b/i.exec(line)
    if (header) {
      // TD is Mermaid's alias for TB, and dagre doesn't know it.
      rankdir = header[1].toUpperCase() === 'TD' ? 'TB' : header[1].toUpperCase()
      continue
    }
    if (/^(?:flowchart|graph)\b/i.test(line)) continue
    // Not supported, and silently ignoring them beats failing the scene.
    if (/^(subgraph|end|style|classDef|class|click|linkStyle|direction)\b/i.test(line)) continue

    const split = splitEdge(line)
    if (!split) {
      const single = readNode(line)
      if (single && !nodes.has(single.id)) {
        nodes.set(single.id, { label: single.label, shape: single.shape })
      }
      continue
    }

    // `-->|label|` and `-- label -->` both put the label between the ends.
    let right = split.right
    let label = ''
    const piped = /^\s*\|([^|]*)\|/.exec(right)
    if (piped) {
      label = unquote(piped[1])
      right = right.slice(piped[0].length)
    }

    const from = readNode(split.left)
    const to = readNode(right)
    if (!from || !to) continue

    for (const node of [from, to]) {
      const existing = nodes.get(node.id)
      // A later mention with a real label wins over a bare id reference.
      if (!existing || (existing.label === node.id && node.label !== node.id)) {
        nodes.set(node.id, { label: node.label, shape: node.shape })
      }
    }
    edges.push({ from: from.id, to: to.id, label: label.trim(), dashed: split.dashed })
  }

  if (!nodes.size) return null

  // A long chain laid out top-down is far taller than a board; the same chain
  // laid out left-to-right fits comfortably. Try the direction asked for, and
  // fall back to the other one when it doesn't fit rather than shrinking a
  // diagram that would have been fine turned on its side.
  const first = layout(nodes, edges, rankdir)
  const flipped = rankdir === 'TB' || rankdir === 'BT' ? 'LR' : 'TB'
  const best =
    fits(first, fit) || nodes.size < 3 ? first : better(first, layout(nodes, edges, flipped), fit)
  if (!best) return null

  // Still too big: shrink it, and the labels shrink with it — see expandDiagram.
  const scale = Math.min(1, fit.maxW / best.width, fit.maxH / best.height)
  if (scale < 1) {
    for (const node of best.nodes) {
      node.x *= scale
      node.y *= scale
      node.w *= scale
      node.h *= scale
    }
    best.width *= scale
    best.height *= scale
  }

  return {
    ...best,
    edges: edges.filter((edge) => nodes.has(edge.from) && nodes.has(edge.to)),
    scale,
  }
}

type Laid = { nodes: MermaidNode[]; width: number; height: number }

function fits(graph: Laid | null, fit: { maxW: number; maxH: number }) {
  return Boolean(graph && graph.width <= fit.maxW && graph.height <= fit.maxH)
}

/** Whichever of the two needs less shrinking to fit. */
function better(a: Laid | null, b: Laid | null, fit: { maxW: number; maxH: number }) {
  if (!a) return b
  if (!b) return a
  const scale = (g: Laid) => Math.min(1, fit.maxW / g.width, fit.maxH / g.height)
  return scale(b) > scale(a) ? b : a
}

function layout(
  nodes: Map<string, { label: string; shape: NodeShape }>,
  edges: MermaidEdge[],
  rankdir: string
): Laid | null {
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({
    rankdir,
    // Generous, because these gaps are where the edge labels go.
    nodesep: 70,
    ranksep: label(edges) ? 130 : 100,
    marginx: 0,
    marginy: 0,
  })
  graph.setDefaultEdgeLabel(() => ({}))

  for (const [id, node] of nodes) {
    // dagre's own field names, which are not the board's.
    const size = sizeFor(node.label)
    graph.setNode(id, { width: size.w, height: size.h })
  }
  for (const edge of edges) {
    if (nodes.has(edge.from) && nodes.has(edge.to)) graph.setEdge(edge.from, edge.to)
  }

  dagre.layout(graph)

  const placed: MermaidNode[] = []
  for (const [id, node] of nodes) {
    const laid = graph.node(id) as { x: number; y: number; width: number; height: number }
    if (!laid) continue
    placed.push({
      id,
      label: node.label,
      shape: node.shape,
      // dagre centres its nodes; the board addresses shapes by their corner.
      x: laid.x - laid.width / 2,
      y: laid.y - laid.height / 2,
      w: laid.width,
      h: laid.height,
    })
  }
  if (!placed.length) return null

  const minX = Math.min(...placed.map((node) => node.x))
  const minY = Math.min(...placed.map((node) => node.y))
  for (const node of placed) {
    node.x -= minX
    node.y -= minY
  }

  return {
    nodes: placed,
    width: Math.max(...placed.map((node) => node.x + node.w)),
    height: Math.max(...placed.map((node) => node.y + node.h)),
  }
}

function label(edges: MermaidEdge[]) {
  return edges.some((edge) => edge.label)
}
