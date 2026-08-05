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
  /** Winding milestone road — processes, timelines, anything sequential. */
  'journey',
  /** A row of pillar cards — categories, components, options. */
  'pillars',
  /** A large photograph beside captioned points — real objects, places. */
  'spotlight',
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
}

export interface TemplateScene {
  id: string
  template: TemplateKind
  /** Short scene title — the design gives it a dedicated block. */
  title: string
  /** One supporting line under the title. '' allowed. */
  subtitle: string
  narration: string
  /** Image-search query for `spotlight`; '' for other templates. */
  image: string
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
  required: ['id', 'template', 'title', 'subtitle', 'narration', 'image', 'items'],
  properties: {
    id: { type: 'string' },
    template: { type: 'string', enum: [...TEMPLATES] },
    title: { type: 'string' },
    subtitle: { type: 'string' },
    narration: { type: 'string' },
    image: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'body', 'icon', 'anchor', 'at'],
        properties: {
          heading: { type: 'string' },
          body: { type: 'string' },
          icon: { type: 'string' },
          anchor: { type: 'string' },
          at: { type: 'number' },
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
    image: template === 'spotlight' ? text(scene.image, 120) : '',
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
