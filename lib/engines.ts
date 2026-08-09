/** One engine remains: the whiteboard. The type survives so the routes and
 * the studio can keep speaking in terms of an engine without caring that
 * there is only one answer now. */

export const ENGINES = ['whiteboard'] as const
export type Engine = (typeof ENGINES)[number]

export const DEFAULT_ENGINE: Engine = 'whiteboard'

export function isEngine(value: unknown): value is Engine {
  return ENGINES.includes(value as Engine)
}
