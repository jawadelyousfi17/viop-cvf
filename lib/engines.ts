/**
 * The two rendering engines, and the per-engine pieces the shared API routes
 * need. Everything else — voice, images, follow-ups, the proxy — is engine
 * agnostic and shared.
 */

export const ENGINES = ['whiteboard', 'slides'] as const
export type Engine = (typeof ENGINES)[number]

export const DEFAULT_ENGINE: Engine = 'slides'

export function isEngine(value: unknown): value is Engine {
  return value === 'whiteboard' || value === 'slides'
}

export const ENGINE_LABELS: Record<Engine, { name: string; hint: string }> = {
  whiteboard: {
    name: 'Whiteboard',
    hint: 'Drawn live on an infinite canvas, like a teacher at a board',
  },
  slides: {
    name: 'Slides',
    hint: 'Designed layouts filled in as the narration reaches them',
  },
}
