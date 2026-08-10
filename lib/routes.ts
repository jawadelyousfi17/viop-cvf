/**
 * Where each kind of work lives.
 *
 * The workspace used to be one address with everything held in memory, so a
 * lesson someone was halfway through could not be linked to, bookmarked, or
 * recovered by reloading — and the browser's back button walked out of the app
 * rather than back through it. One route per thing fixes all three at once.
 *
 * The three kinds are separate paths rather than `/w/[id]` with a lookup,
 * because the id alone does not say which table to read and guessing across
 * three of them is three queries to answer a question the URL could have
 * answered for free.
 */

export type WorkKind = 'map' | 'lesson' | 'math'

/** The address of one piece of work. */
export function routeFor(kind: WorkKind, id: string) {
  if (kind === 'lesson') return `/lesson/${id}`
  if (kind === 'math') return `/solution/${id}`
  return `/mindmap/${id}`
}

/** The workspace with nothing open, which is also where "new" goes. */
export const WORKSPACE = '/mindmap'

/**
 * What the address bar should say, without a navigation.
 *
 * Opening a map is not a page load — the board is already mounted and the data
 * is already in hand — so this writes the URL directly rather than routing to
 * it. `replaceState` rather than `push`: clicking through six items in the rail
 * should not bury the way out under six back presses.
 */
export function showRoute(path: string) {
  if (typeof window === 'undefined') return
  if (window.location.pathname === path) return
  window.history.replaceState(null, '', path)
}
