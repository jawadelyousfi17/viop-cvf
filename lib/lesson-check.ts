import {
  normalizeScene,
  POINT_KINDS,
  SCENE_H,
  SCENE_W,
  type BoardShape,
  type Lesson,
  type Scene,
} from './lesson'

/**
 * The checks that decide whether a scene will actually play well.
 *
 * These were written by hand, one throwaway script at a time, every time a
 * lesson looked wrong — anchors that don't appear in the narration, shapes
 * stacked on each other, a scene so tall the camera fits it by height and
 * leaves a third of the screen empty. Collected here so the authoring tool can
 * run them on every keystroke, and so "is this good" has one answer rather
 * than a different ad-hoc script each time.
 *
 * Everything is measured on the NORMALIZED scene — after layout, spacing and
 * the diagram have been expanded — because that is what actually gets drawn.
 * Checking the authored coordinates would be checking the wrong thing.
 */

export type Severity = 'error' | 'warning'

export interface Issue {
  severity: Severity
  /** Which shape it's about, when it's about one. */
  shapeId?: string
  message: string
}

export interface SceneReport {
  index: number
  issues: Issue[]
  /** Post-layout content box, as a share of the board. */
  widthUsed: number
  aspect: number
  contentW: number
  contentH: number
  shapes: number
  words: number
  /** Shapes whose anchor appears verbatim, over shapes that have one. */
  anchored: { matched: number; total: number }
  kinds: string[]
}

export interface LessonReport {
  scenes: SceneReport[]
  errors: number
  warnings: number
  kinds: string[]
}

/** Connectors and gestures: they follow other shapes, so never packed. */
const FLOATING = new Set(['arrow', 'elbow', 'curve', 'line', 'highlight', 'laser', 'ring'])

/** An empty dashed box is a grouping frame — it is meant to contain things. */
const isFrame = (shape: BoardShape) =>
  shape.kind === 'box' && !shape.text.trim() && (shape.dash === 'dashed' || shape.dash === 'dotted')

/** 16:9. A scene much taller than this gets fitted by height, wasting the width. */
const IDEAL_ASPECT = SCENE_W / SCENE_H

export function checkScene(raw: Scene, index: number): SceneReport {
  const issues: Issue[] = []
  const scene = normalizeScene(structuredClone(raw), index)

  const narration = (raw.narration ?? '').trim()
  const words = narration.split(/\s+/).filter(Boolean).length

  if (!narration) issues.push({ severity: 'error', message: 'No narration.' })
  else if (words < 25) {
    issues.push({ severity: 'warning', message: `Narration is short (${words} words; aim for 35-70).` })
  } else if (words > 85) {
    issues.push({ severity: 'warning', message: `Narration is long (${words} words; aim for 35-70).` })
  }

  // Anchors. The single thing most worth checking: an anchor that isn't in the
  // narration silently falls back to the `at` fraction, and the shape lands
  // near its moment instead of on it.
  const withAnchor = (raw.shapes ?? []).filter((shape) => shape?.anchor?.trim())
  let matched = 0
  for (const shape of withAnchor) {
    if (narration.includes(shape.anchor)) matched++
    else {
      issues.push({
        severity: 'error',
        shapeId: shape.id,
        message: `Anchor "${shape.anchor}" is not in the narration, character for character.`,
      })
    }
  }
  for (const entry of raw.diagram?.timing ?? []) {
    if (!entry?.anchor?.trim()) continue
    if (narration.includes(entry.anchor)) matched++
    else {
      issues.push({
        severity: 'error',
        shapeId: entry.node,
        message: `Diagram anchor "${entry.anchor}" is not in the narration.`,
      })
    }
  }
  const totalAnchors = withAnchor.length + (raw.diagram?.timing ?? []).filter((t) => t?.anchor?.trim()).length

  // Point kinds need points, or they silently degrade to a text shape.
  for (const shape of raw.shapes ?? []) {
    if (!shape) continue
    if (POINT_KINDS.has(shape.kind) && (shape.points?.length ?? 0) < 2) {
      issues.push({
        severity: 'error',
        shapeId: shape.id,
        message: `A "${shape.kind}" needs at least two points.`,
      })
    }
    if (shape.kind === 'image' && !shape.text.trim()) {
      issues.push({ severity: 'error', shapeId: shape.id, message: 'An image needs a search query in its text.' })
    }
    if (shape.kind.endsWith('chart') && !(shape.data?.length)) {
      issues.push({ severity: 'error', shapeId: shape.id, message: 'A chart needs data.' })
    }
    if (shape.kind === 'arrow' && shape.from && shape.to && shape.from === shape.to) {
      issues.push({ severity: 'warning', shapeId: shape.id, message: 'Arrow points at itself.' })
    }
  }

  // Overlaps, measured after layout. Frames and grouped shapes are exempt:
  // a frame is meant to contain things, and a diagram's own nodes were
  // arranged by dagre.
  const solid = scene.shapes.filter((shape) => !FLOATING.has(shape.kind))
  for (let a = 0; a < solid.length; a++) {
    for (let b = a + 1; b < solid.length; b++) {
      const p = solid[a]
      const q = solid[b]
      if (p.group && p.group === q.group) continue
      if (isFrame(p) || isFrame(q)) continue
      if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) {
        issues.push({
          severity: 'warning',
          shapeId: p.id,
          message: `Overlaps "${q.id}" after layout.`,
        })
      }
    }
  }

  const box = solid.length
    ? {
        minX: Math.min(...solid.map((s) => s.x)),
        maxX: Math.max(...solid.map((s) => s.x + s.w)),
        minY: Math.min(...solid.map((s) => s.y)),
        maxY: Math.max(...solid.map((s) => s.y + s.h)),
      }
    : { minX: 0, maxX: 0, minY: 0, maxY: 0 }

  const contentW = box.maxX - box.minX
  const contentH = box.maxY - box.minY
  const aspect = contentH > 0 ? contentW / contentH : 0

  if (solid.length && aspect > 0 && aspect < IDEAL_ASPECT * 0.75) {
    issues.push({
      severity: 'warning',
      message: `Scene is tall (aspect ${aspect.toFixed(2)} against 16:9's ${IDEAL_ASPECT.toFixed(2)}). The camera will fit it by height and leave the sides empty.`,
    })
  }
  if (solid.length && contentW / SCENE_W < 0.7) {
    issues.push({
      severity: 'warning',
      message: `Only ${Math.round((contentW / SCENE_W) * 100)}% of the board's width is used.`,
    })
  }
  // Density, weighted rather than counted. A `table` carries a dozen facts and
  // a chart carries its whole dataset, so a scene built from three composites
  // is a full board while a scene of six labels is not — counting shapes flat
  // would call the first one sparse and the second one finished.
  const weight = scene.shapes.reduce((sum, shape) => {
    if (shape.kind === 'table' || shape.kind === 'stack' || shape.kind === 'array') return sum + 4
    if (shape.kind.endsWith('chart')) return sum + 4
    if (shape.kind === 'image' || shape.kind === 'note') return sum + 2
    if (FLOATING.has(shape.kind)) return sum + 0.5
    return sum + 1
  }, 0)
  if (weight < 10) {
    issues.push({
      severity: 'warning',
      message: `Thin scene (weight ${weight.toFixed(1)} of 10). Add numbers, a second case, or labels on the parts.`,
    })
  }

  return {
    index,
    issues,
    widthUsed: SCENE_W ? contentW / SCENE_W : 0,
    aspect,
    contentW: Math.round(contentW),
    contentH: Math.round(contentH),
    shapes: scene.shapes.length,
    words,
    anchored: { matched, total: totalAnchors },
    kinds: [...new Set(scene.shapes.map((s) => s.kind))].sort(),
  }
}

export function checkLesson(lesson: Lesson): LessonReport {
  const scenes = (lesson.scenes ?? []).map((scene, index) => checkScene(scene, index))
  const kinds = [...new Set(scenes.flatMap((s) => s.kinds))].sort()

  return {
    scenes,
    kinds,
    errors: scenes.reduce((n, s) => n + s.issues.filter((i) => i.severity === 'error').length, 0),
    warnings: scenes.reduce((n, s) => n + s.issues.filter((i) => i.severity === 'warning').length, 0),
  }
}

/**
 * Serialises a lesson as a `demo-lesson.ts` module, so a board built in the
 * authoring tool can be dropped straight into the repo as the demo.
 */
export function toDemoModule(lesson: Lesson): string {
  const scenes = lesson.scenes
    .map((scene) => {
      const shapes = scene.shapes
        .map((shape) => `        ${JSON.stringify(stripDefaults(shape))},`)
        .join('\n')
      const diagram = scene.diagram?.source
        ? `      diagram: ${JSON.stringify(scene.diagram, null, 2).replace(/\n/g, '\n      ')},\n`
        : ''
      return `    {
      id: ${JSON.stringify(scene.id)},
      heading: ${JSON.stringify(scene.heading ?? '')},
${diagram}      narration:
        ${JSON.stringify(scene.narration)},
      shapes: [
${shapes}
      ].map((shape) => s(shape as Partial<BoardShape> & Pick<BoardShape, 'id' | 'kind' | 'at'>)),
    },`
    })
    .join('\n')

  return `import type { BoardShape, Lesson } from './lesson'

/** Fills the defaults so a shape only has to state what's interesting. */
function s(shape: Partial<BoardShape> & Pick<BoardShape, 'id' | 'kind' | 'at'>): BoardShape {
  return {
    text: '', x: 60, y: 60, w: 300, h: 120, from: null, to: null,
    color: 'black', fill: 'none', size: 'm', dash: 'draw',
    anchor: '', points: [], data: [],
    ...shape,
  }
}

/** Built in the authoring tool at /author. */
export const DEMO_LESSON: Lesson = {
  title: ${JSON.stringify(lesson.title)},
  summary: ${JSON.stringify(lesson.summary)},
  scenes: [
${scenes}
  ],
}
`
}

/** Drops fields that match the default, so the emitted module stays readable. */
function stripDefaults(shape: BoardShape) {
  const defaults: Record<string, unknown> = {
    text: '', from: null, to: null, color: 'black', fill: 'none',
    size: 'm', dash: 'draw', anchor: '',
  }
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(shape)) {
    if (key === 'group') continue
    if ((key === 'points' || key === 'data') && Array.isArray(value) && !value.length) continue
    if (key in defaults && JSON.stringify(defaults[key]) === JSON.stringify(value)) continue
    out[key] = value
  }
  return out
}
