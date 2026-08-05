/**
 * The lesson language for the template engine.
 *
 * Unlike the whiteboard engine (main branch), the model never plans
 * coordinates. Each scene picks one of a small set of professionally designed
 * layouts and fills its slots — title, items, an image query — and the
 * renderer owns every pixel. Layout quality stops depending on the model
 * having spatial taste.
 */

export const TEMPLATES = [
  /** Winding milestone road — processes with a sense of travel. */
  'journey',
  /** A row of pillar cards — categories, components, options. */
  'pillars',
  /** A large photograph beside captioned points — real objects, places. */
  'spotlight',
  /** Horizontal chevron timeline with alternating captions — history, eras. */
  'timeline',
  /** Numbered badge row — an ordered procedure, 01..06. */
  'steps',
  /** Narrowing cone — filtering, attrition, selection. */
  'funnel',
  /** Central hub with items radiating both sides — facets of one thing. */
  'mindmap',
  /** A grid of photographs with captions — specimens, examples, variety. */
  'gallery',
  /** Two photographed things side by side — before and after, this versus that. */
  'compare',
  /** Full-bleed photograph with the title over it — openings, big reveals. */
  'hero',
  /** A designed data table — comparisons, specs, lookups. */
  'table',
  /** A bar chart drawn to scale — magnitudes worth comparing. */
  'chart',
  /** Three or four large figures — the numbers that carry the point. */
  'stats',
] as const

export type TemplateKind = (typeof TEMPLATES)[number]

export interface TemplateItem {
  /** 2-5 words, shown bold on the card. */
  heading: string
  /** One short supporting line. */
  body: string
  /** A single emoji, shown in the card's icon chip. */
  icon: string
  /** Phrase copied verbatim from the narration; reveals the item on that word. */
  anchor: string
  /** Fallback reveal moment, fraction 0-1 of the narration. */
  at: number
  /** Image-search query for `gallery` items; '' elsewhere. */
  image: string
}

export interface TemplateScene {
  id: string
  template: TemplateKind
  /** Short scene title — the design gives it a dedicated block. */
  title: string
  /** One supporting line under the title. '' allowed. */
  subtitle: string
  narration: string
  /** Image-search query for `spotlight` and `hero`; '' for other templates. */
  image: string
  /**
   * Rows for `table` and `chart`: newlines separate rows, pipes separate
   * columns. Encoded in one string rather than a nested array so the schema
   * stays cheap on every scene that doesn't use it.
   */
  data: string
  items: TemplateItem[]
}

export interface TemplateLesson {
  title: string
  summary: string
  scenes: TemplateScene[]
}

export const SCENE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'template', 'title', 'subtitle', 'narration', 'image', 'data', 'items'],
  properties: {
    id: { type: 'string' },
    template: { type: 'string', enum: [...TEMPLATES] },
    title: { type: 'string' },
    subtitle: { type: 'string' },
    narration: { type: 'string' },
    image: { type: 'string' },
    data: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'body', 'icon', 'anchor', 'at', 'image'],
        properties: {
          heading: { type: 'string' },
          body: { type: 'string' },
          icon: { type: 'string' },
          anchor: { type: 'string' },
          at: { type: 'number' },
          image: { type: 'string' },
        },
      },
    },
  },
} as const

export const LESSON_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'scenes'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    scenes: { type: 'array', items: SCENE_JSON_SCHEMA },
  },
} as const

/** Rough words-per-second for timing when TTS is unavailable. */
const WORDS_PER_SECOND = 2.6

export function estimateNarrationSeconds(narration: string) {
  const words = narration.trim().split(/\s+/).filter(Boolean).length
  return Math.max(3, words / WORDS_PER_SECOND + 0.8)
}

export function isRenderableScene(scene: TemplateScene | null | undefined): scene is TemplateScene {
  return !!scene && typeof scene.narration === 'string' && scene.narration.trim().length > 0
}

/** Per-template bounds on how many items the layout can hold. */
const ITEM_LIMITS: Record<TemplateKind, { min: number; max: number }> = {
  journey: { min: 3, max: 5 },
  pillars: { min: 2, max: 4 },
  spotlight: { min: 2, max: 4 },
  timeline: { min: 3, max: 6 },
  steps: { min: 3, max: 6 },
  funnel: { min: 3, max: 5 },
  mindmap: { min: 4, max: 8 },
  gallery: { min: 3, max: 6 },
  compare: { min: 2, max: 2 },
  hero: { min: 0, max: 3 },
  table: { min: 0, max: 3 },
  chart: { min: 0, max: 3 },
  stats: { min: 2, max: 4 },
}

/**
 * Templates whose ITEMS each carry a photograph. Any of these can put several
 * pictures on one slide, which is what a comparison or a set of specimens
 * actually needs — one hero image per scene is not always enough.
 */
export const GALLERY_TEMPLATES = new Set<TemplateKind>(['gallery', 'compare', 'pillars'])
/** Templates with one scene-level photograph. */
export const PHOTO_TEMPLATES = new Set<TemplateKind>(['spotlight', 'hero'])
/** Templates driven by the `data` slot rather than by items. */
export const DATA_TEMPLATES = new Set<TemplateKind>(['table', 'chart'])

/** Splits the `data` slot: newlines are rows, pipes are columns. */
export function parseGrid(data: string): string[][] {
  return data
    .split('\n')
    .map((row) => row.split('|').map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean))
}

/**
 * Repairs a streamed scene into something every template can render: trims
 * strings to what the cards actually fit, clamps item counts to the layout's
 * capacity, and makes reveal fractions monotonic so items appear in order.
 */
export function normalizeScene(scene: TemplateScene, sceneIndex: number): TemplateScene {
  const template = TEMPLATES.includes(scene.template) ? scene.template : 'journey'
  const limits = ITEM_LIMITS[template]

  const items = (Array.isArray(scene.items) ? scene.items : [])
    .filter((item) => item && (typeof item.heading === 'string' || typeof item.body === 'string'))
    .slice(0, limits.max)
    .map((item, i, all) => ({
      heading: text(item.heading, 48) || `Step ${i + 1}`,
      body: text(item.body, 90),
      icon: firstGlyph(item.icon) || '✦',
      anchor: text(item.anchor, 60),
      image: text(item.image, 120),
      at: clamp(
        typeof item.at === 'number' && Number.isFinite(item.at) ? item.at : (i + 1) / (all.length + 1),
        0.05,
        0.95
      ),
    }))

  // Items reveal in card order; a later card can't precede an earlier one.
  for (let i = 1; i < items.length; i++) {
    items[i].at = Math.max(items[i].at, items[i - 1].at)
  }

  return {
    id: scene.id || `scene-${sceneIndex + 1}`,
    template,
    title: text(scene.title, 60) || 'Untitled',
    subtitle: text(scene.subtitle, 110),
    narration: (scene.narration ?? '').trim(),
    image: PHOTO_TEMPLATES.has(template) ? text(scene.image, 120) : '',
    data: DATA_TEMPLATES.has(template) ? text(scene.data, 900) : '',
    items,
  }
}

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/** First grapheme-ish glyph of a string — keeps one emoji, drops the rest. */
function firstGlyph(value: unknown) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  return [...trimmed][0] ?? ''
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
