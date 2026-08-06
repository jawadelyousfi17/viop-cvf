/**
 * The "IT explain" board language.
 *
 * A different animal from the whiteboard engine. That one imitates a person at
 * a board: hand-drawn strokes, a wobble on every shape, things written where
 * they fall. This one imitates the diagrams in a good systems explainer —
 * flat vector geometry on black, drawn precisely, where the composition is
 * fixed and only the content moves.
 *
 * Two ideas carry the whole style.
 *
 * **Colour is identity.** An actor — a process, a request, a packet — is given
 * a colour when it first appears, and that colour follows it everywhere after:
 * the border of its card, the line running from it, the region of memory it
 * owns, the bracket under that region. You read the diagram by following a
 * colour, not by reading labels.
 *
 * **The composition is fixed.** Elements do not carry coordinates. They declare
 * which zone of the board they belong to and stack within it, so a scene cannot
 * overlap itself no matter what the model asks for. The reference this is drawn
 * from reuses four compositions across a fifteen-minute video, and holding a
 * composition still while things animate into it is most of why it reads as
 * designed rather than assembled.
 */

/** 16:9, matching the screen it plays on. */
export const BOARD_W = 1920
export const BOARD_H = 1080

/** Vertical space between scenes on the shared canvas. */
export const BOARD_GAP = 900

const MARGIN = 80
/** Between the zone columns, and between elements stacked inside one. */
const GAP = 56

/**
 * One typeface for prose, one for code. The reference uses a plain grotesque
 * for every label and a monospace only inside code, and that restraint is what
 * keeps a black board from looking like a slide deck.
 */
export const IT_FONT = 'sans' as const
export const IT_CODE_FONT = 'mono' as const

/**
 * The actor palette. Deliberately saturated: these sit on black, where the
 * pale tints a whiteboard wants would disappear. `white` is the neutral —
 * structure, the machine itself, anything that isn't one of the actors.
 */
export const IT_COLORS = [
  'white',
  'red',
  'green',
  'blue',
  'yellow',
  'violet',
  'orange',
  'grey',
] as const

export type ITColor = (typeof IT_COLORS)[number]

/**
 * Where an element lives. The three columns share the upper band; `bottom`
 * spans the full width beneath them. A zone with nothing in it takes no space,
 * so a scene using only `left` and `bottom` gets a wide left column rather
 * than a third of one.
 */
export const ZONES = ['left', 'centre', 'right', 'bottom'] as const
export type Zone = (typeof ZONES)[number]

export const IT_KINDS = [
  /** An actor: rounded rect, coloured border, an emoji and a name. */
  'card',
  /** A wide labelled bar — the machine, the kernel, the layer everything sits on. */
  'bar',
  /** A run of equal cells. Memory, a buffer, a tape, a disk. */
  'cells',
  /** A tall bar divided into proportional coloured segments. */
  'column',
  /** Syntax-coloured source with one line boxed. */
  'code',
  /** A piece of hardware: a big emoji with a name under it. */
  'device',
  /** A heading for a zone. */
  'label',
  /** A caption, set small and grey. */
  'note',
  /** Something an actor says, in a bubble with a tail pointing at it. */
  'bubble',
  /** A squared bracket spanning another element, labelled underneath. */
  'bracket',
  /** An orthogonal connector between two elements, in the source's colour. */
  'link',
  /** A red cross stamped over something that fails. */
  'cross',
] as const

export type ITKind = (typeof IT_KINDS)[number]

/** Kinds that take a slot in a zone. Everything else attaches to one of these. */
const STACKED = new Set<ITKind>([
  'card',
  'bar',
  'cells',
  'column',
  'code',
  'device',
  'label',
  'note',
])

/** Kinds that hang off another element rather than occupying space. */
const ATTACHED = new Set<ITKind>(['bubble', 'bracket', 'link', 'cross'])

/** A coloured run inside a `cells` strip or a `column`. */
export interface ITSpan {
  /** First cell, counting from zero. For a column, the segment's order. */
  from: number
  /** One past the last cell. For a column, unused — `weight` sizes it. */
  to: number
  /** How much of a column this segment takes, relative to its siblings. */
  weight: number
  color: ITColor
  label: string
}

export interface ITElement {
  id: string
  kind: ITKind
  zone: Zone
  /** The label, the caption, or the bubble's words. */
  text: string
  /** A single emoji for `card` and `device`. */
  icon: string
  color: ITColor
  /** How many cells a `cells` strip has. */
  cells: number
  /** Coloured runs within a `cells` or `column`. */
  spans: ITSpan[]
  /** Source lines for `code`. */
  lines: string[]
  /** Which of those lines is boxed, or -1 for none. */
  highlight: number
  /** `link` source, and the element a bubble, bracket or cross attaches to. */
  from: string | null
  /** `link` target. */
  to: string | null
  /** A link that is a request rather than an established route. */
  dashed: boolean
  /** When this appears, as a fraction of the narration. */
  at: number
  /** Words copied from the narration, so it lands on the beat. */
  anchor: string

  // Filled in by layout; never written by the model.
  x: number
  y: number
  w: number
  h: number
}

export interface ITScene {
  id: string
  narration: string
  elements: ITElement[]
}

export interface ITLesson {
  title: string
  summary: string
  scenes: ITScene[]
}

/**
 * Strict JSON schema for structured outputs. Strict mode requires every
 * property in `required` and forbids extras, so optional fields are expressed
 * as empty values rather than omitted ones. Geometry is absent on purpose:
 * the model chooses a zone, never a coordinate.
 */
export const IT_SCENE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'narration', 'elements'],
  properties: {
    id: { type: 'string' },
    narration: { type: 'string' },
    elements: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'kind',
          'zone',
          'text',
          'icon',
          'color',
          'cells',
          'spans',
          'lines',
          'highlight',
          'from',
          'to',
          'dashed',
          'at',
          'anchor',
        ],
        properties: {
          id: { type: 'string' },
          kind: { type: 'string', enum: [...IT_KINDS] },
          zone: { type: 'string', enum: [...ZONES] },
          text: { type: 'string' },
          icon: { type: 'string' },
          color: { type: 'string', enum: [...IT_COLORS] },
          cells: { type: 'number' },
          spans: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['from', 'to', 'weight', 'color', 'label'],
              properties: {
                from: { type: 'number' },
                to: { type: 'number' },
                weight: { type: 'number' },
                color: { type: 'string', enum: [...IT_COLORS] },
                label: { type: 'string' },
              },
            },
          },
          lines: { type: 'array', items: { type: 'string' } },
          highlight: { type: 'number' },
          from: { type: ['string', 'null'] },
          to: { type: ['string', 'null'] },
          dashed: { type: 'boolean' },
          at: { type: 'number' },
          anchor: { type: 'string' },
        },
      },
    },
  },
} as const

export const IT_LESSON_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'scenes'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    scenes: { type: 'array', items: IT_SCENE_JSON_SCHEMA },
  },
} as const

/** One scene alone, for answering a question mid-lesson. */
export const IT_ANSWER_JSON_SCHEMA = IT_SCENE_JSON_SCHEMA

export function sceneOffsetY(index: number) {
  return index * (BOARD_H + BOARD_GAP)
}

/** Rough words-per-second, for pacing a scene before the audio lands. */
const WORDS_PER_SECOND = 2.6

export function estimateNarrationSeconds(narration: string) {
  const words = narration.trim().split(/\s+/).filter(Boolean).length
  return Math.max(3, words / WORDS_PER_SECOND + 0.8)
}

export function isRenderableScene(scene: ITScene | null | undefined): scene is ITScene {
  return !!scene && typeof scene.narration === 'string' && scene.narration.trim().length > 0
}

/**
 * The room each kind wants before the zone is fitted to it.
 *
 * Widths are a share of the zone rather than an absolute, because a zone is
 * as wide as the scene's own composition makes it — a two-zone scene has much
 * wider columns than a three-zone one.
 */
function intrinsic(element: ITElement, zoneW: number): { w: number; h: number } {
  switch (element.kind) {
    case 'card':
      return { w: Math.min(zoneW, 320), h: element.text ? 240 : 200 }
    case 'bar':
      return { w: zoneW, h: 130 }
    case 'cells':
      return { w: zoneW, h: 96 }
    case 'column':
      // Tall and narrow: the point of a column is that height means quantity.
      return { w: Math.min(zoneW, 200), h: 640 }
    case 'code':
      return { w: zoneW, h: Math.max(160, element.lines.length * 62 + 56) }
    case 'device':
      return { w: Math.min(zoneW, 220), h: 230 }
    case 'label':
      return { w: zoneW, h: 76 }
    case 'note':
      return { w: zoneW, h: 64 }
    default:
      return { w: 0, h: 0 }
  }
}

/**
 * Places a scene's elements.
 *
 * Zones that have content split the usable width between them; the bottom zone
 * takes a full-width band underneath. Within a zone everything stacks in the
 * order the model wrote it, and if the stack is taller than the band it is
 * scaled down as a piece rather than being allowed to run off the board.
 *
 * Attached kinds — bubbles, brackets, links, crosses — are given no slot. They
 * are positioned against the element they belong to once everything else has
 * settled, which is the only point at which their target's box is known.
 */
function layout(elements: ITElement[]): ITElement[] {
  const stacked = elements.filter((element) => STACKED.has(element.kind))
  if (!stacked.length) return elements

  const columns = (['left', 'centre', 'right'] as const).filter((zone) =>
    stacked.some((element) => element.zone === zone)
  )
  const hasBottom = stacked.some((element) => element.zone === 'bottom')

  const usableW = BOARD_W - MARGIN * 2
  const usableH = BOARD_H - MARGIN * 2

  // The bottom band takes what it needs, capped so it can never crowd out the
  // columns above it.
  const bottomEls = stacked.filter((element) => element.zone === 'bottom')
  const bottomWant = hasBottom
    ? bottomEls.reduce((sum, el) => sum + intrinsic(el, usableW).h, 0) +
      GAP * Math.max(0, bottomEls.length - 1)
    : 0
  const bottomH = Math.min(bottomWant, usableH * 0.42)
  const topH = usableH - (hasBottom ? bottomH + GAP : 0)

  const columnW = columns.length
    ? (usableW - GAP * (columns.length - 1)) / columns.length
    : usableW

  for (const [index, zone] of columns.entries()) {
    place(
      stacked.filter((element) => element.zone === zone),
      MARGIN + index * (columnW + GAP),
      MARGIN,
      columnW,
      topH
    )
  }

  if (hasBottom) {
    place(bottomEls, MARGIN, MARGIN + topH + GAP, usableW, bottomH)
  }

  return elements
}

/** Stacks one zone's elements into its band, centred, scaled down if over. */
function place(elements: ITElement[], x: number, y: number, w: number, h: number) {
  if (!elements.length) return

  const sizes = elements.map((element) => intrinsic(element, w))
  const wanted =
    sizes.reduce((sum, size) => sum + size.h, 0) + GAP * (elements.length - 1)

  // Never scale up: a single card in a tall column should stay a card, not
  // become a poster.
  const scale = wanted > h ? h / wanted : 1
  const gap = GAP * scale
  const used = sizes.reduce((sum, size) => sum + size.h * scale, 0) + gap * (elements.length - 1)

  let top = y + Math.max(0, (h - used) / 2)
  for (const [index, element] of elements.entries()) {
    const size = sizes[index]
    element.w = Math.min(w, size.w * (size.w >= w ? scale : 1))
    element.h = size.h * scale
    element.x = x + (w - element.w) / 2
    element.y = top
    top += element.h + gap
  }
}

/**
 * Positions everything that hangs off another element.
 *
 * Runs after layout because each of these is defined relative to a box that
 * does not exist until then: a bubble sits beside its speaker, a bracket under
 * its range, a cross over its victim.
 */
function attach(elements: ITElement[]): ITElement[] {
  const byId = new Map(elements.map((element) => [element.id, element]))

  for (const element of elements) {
    if (!ATTACHED.has(element.kind)) continue

    if (element.kind === 'link') {
      // A link has no box of its own; the painter routes it between the two
      // ends. Its own rect is only used for camera framing.
      const from = element.from ? byId.get(element.from) : null
      const to = element.to ? byId.get(element.to) : null
      if (!from || !to) continue
      element.x = Math.min(from.x, to.x)
      element.y = Math.min(from.y, to.y)
      element.w = Math.max(from.x + from.w, to.x + to.w) - element.x
      element.h = Math.max(from.y + from.h, to.y + to.h) - element.y
      continue
    }

    const target = element.from ? byId.get(element.from) : null
    if (!target) continue

    if (element.kind === 'bubble') {
      element.w = 300
      element.h = 170
      // To the right of the speaker where there is room, otherwise the left.
      const right = target.x + target.w + 40
      element.x = right + element.w <= BOARD_W - MARGIN ? right : target.x - element.w - 40
      element.y = target.y - 20
    } else if (element.kind === 'bracket') {
      element.x = target.x
      element.y = target.y + target.h + 12
      element.w = target.w
      element.h = 90
    } else if (element.kind === 'cross') {
      const size = Math.min(target.w, target.h) * 0.7
      element.w = size
      element.h = size
      element.x = target.x + (target.w - size) / 2
      element.y = target.y + (target.h - size) / 2
    }
  }

  return elements
}

/**
 * Repairs one scene into something the board can draw: unknown kinds and
 * colours fall back, dangling references are dropped, and reveal times are
 * clamped so nothing is scheduled past the end of the narration.
 */
export function normalizeScene(scene: ITScene, sceneIndex: number): ITScene {
  const seen = new Set<string>()
  const elements: ITElement[] = []

  for (const [index, raw] of (scene.elements ?? []).entries()) {
    if (!raw) continue

    let id = raw.id || `e${index}`
    while (seen.has(id)) id = `${id}_`
    seen.add(id)

    const kind = IT_KINDS.includes(raw.kind) ? raw.kind : 'label'
    const lines = (Array.isArray(raw.lines) ? raw.lines : [])
      .filter((line) => typeof line === 'string')
      .slice(0, 14)

    const spans = (Array.isArray(raw.spans) ? raw.spans : [])
      .filter((span) => span && Number.isFinite(span.from))
      .slice(0, 12)
      .map((span) => ({
        from: Math.max(0, Math.round(num(span.from, 0))),
        to: Math.max(0, Math.round(num(span.to, 0))),
        weight: Math.max(0, num(span.weight, 1)),
        color: IT_COLORS.includes(span.color) ? span.color : 'white',
        label: String(span.label ?? '').slice(0, 40),
      }))

    elements.push({
      id,
      kind,
      zone: ZONES.includes(raw.zone) ? raw.zone : 'left',
      text: typeof raw.text === 'string' ? raw.text.slice(0, 240) : '',
      // One glyph. A string of emoji reads as a rash, not an icon.
      icon: typeof raw.icon === 'string' ? [...raw.icon.trim()][0] ?? '' : '',
      color: IT_COLORS.includes(raw.color) ? raw.color : 'white',
      cells: clamp(Math.round(num(raw.cells, 16)), 2, 48),
      spans,
      lines,
      highlight: Math.round(num(raw.highlight, -1)),
      from: raw.from || null,
      to: raw.to || null,
      dashed: Boolean(raw.dashed),
      at: clamp(num(raw.at, index / Math.max(1, (scene.elements ?? []).length)), 0, 0.95),
      anchor: typeof raw.anchor === 'string' ? raw.anchor.trim().slice(0, 60) : '',
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    })
  }

  // Drop references to elements that don't exist, so nothing dangles.
  const ids = new Set(elements.map((element) => element.id))
  for (const element of elements) {
    if (element.from && !ids.has(element.from)) element.from = null
    if (element.to && !ids.has(element.to)) element.to = null
  }

  // Nothing attached may appear before what it attaches to.
  const byId = new Map(elements.map((element) => [element.id, element]))
  for (const element of elements) {
    if (!ATTACHED.has(element.kind)) continue
    for (const ref of [element.from, element.to]) {
      const target = ref ? byId.get(ref) : undefined
      if (target) element.at = Math.max(element.at, target.at)
    }
  }

  return {
    id: scene.id || `scene-${sceneIndex + 1}`,
    narration: (scene.narration ?? '').trim(),
    elements: attach(layout(elements)).sort((a, b) => a.at - b.at),
  }
}

export function normalizeLesson(raw: ITLesson): ITLesson {
  return {
    title: raw.title || 'Lesson',
    summary: raw.summary || '',
    scenes: (raw.scenes ?? []).filter(isRenderableScene).map(normalizeScene),
  }
}

function num(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
