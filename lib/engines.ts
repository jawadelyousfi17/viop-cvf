/**
 * The rendering engines, and the per-engine pieces the shared API routes
 * need. Everything else — voice, images, follow-ups, the proxy — is engine
 * agnostic and shared.
 */

export const ENGINES = ['whiteboard', 'canvas', 'slides', 'manim', 'it', 'math', 'slate'] as const
export type Engine = (typeof ENGINES)[number]

export const DEFAULT_ENGINE: Engine = 'slides'

export function isEngine(value: unknown): value is Engine {
  return ENGINES.includes(value as Engine)
}

export const ENGINE_LABELS: Record<Engine, { name: string; hint: string }> = {
  whiteboard: {
    name: 'Whiteboard',
    hint: 'Drawn live on an infinite canvas, like a teacher at a board',
  },
  canvas: {
    name: 'Canvas',
    hint: 'The same hand-drawn board, painted directly — layout resolved before it is drawn',
  },
  slides: {
    name: 'Slides',
    hint: 'Designed layouts filled in as the narration reaches them',
  },
  manim: {
    name: 'Manim',
    hint: 'Animated mathematics — for maths and physics, where the motion is the explanation',
  },
  it: {
    name: 'IT explain',
    hint: 'Precise diagrams on black, built up piece by piece — for how computers actually work',
  },
  slate: {
    name: 'Slate',
    hint: 'Chalk with the guesswork taken out — beats instead of anchors, and a linter that refuses',
  },
  math: {
    name: 'Notebook',
    hint: 'A problem worked through on paper, a line at a time — for anything you solve rather than describe',
  },
}
