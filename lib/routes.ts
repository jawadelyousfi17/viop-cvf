/**
 * Where each kind of work lives.
 *
 * The workspace used to be one address with everything held in memory: which
 * of the three things you were doing was a tab, and which one you had open was
 * a variable. So nothing could be linked to, bookmarked or got back by
 * reloading, and the browser's back button walked out of the app rather than
 * back through it. A section per kind and a route per thing fixes all of it.
 *
 * The three sections are separate paths rather than `/w?mode=` because they are
 * three different things to be doing, and a query string is a setting. The item
 * routes sit under their own section for the same reason a lesson is not found
 * in a list of maps.
 */

export type WorkKind = 'map' | 'lesson' | 'math'

/** The section a kind of work lives in, with nothing open. */
export function sectionFor(kind: WorkKind) {
  if (kind === 'lesson') return '/lessons'
  if (kind === 'math') return '/math-tutor'
  return '/mindmap'
}

/** The address of one piece of work. */
export function routeFor(kind: WorkKind, id: string) {
  return `${sectionFor(kind)}/${id}`
}

/** Where "new" goes, and where the app opens when nothing is asked for. */
export const WORKSPACE = '/lessons'

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
