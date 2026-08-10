import type { BoardColor, BoardShape } from '@/lib/lesson'

/**
 * The board's inks.
 *
 * Three values per colour rather than one. `ink` is the stroke — the marker
 * itself. `wash` is what a filled shape is filled with, pale enough that black
 * lettering still reads on top of it. `shadow` is the saturated twin drawn a
 * few pixels behind a filled shape, which is the single detail that makes a
 * hand-drawn board look designed rather than merely sketched.
 */
const INKS: Record<BoardColor, { ink: string; wash: string; shadow: string }> = {
  black: { ink: '#1d1d1d', wash: '#00000010', shadow: '' },
  grey: { ink: '#8b8b8b', wash: '#8b8b8b1a', shadow: '' },
  blue: { ink: '#3a5ce0', wash: '#3a5ce022', shadow: '#3a5ce0' },
  'light-blue': { ink: '#4ba1f1', wash: '#4ba1f122', shadow: '#3a5ce0' },
  green: { ink: '#0f9066', wash: '#0f906622', shadow: '#0f9066' },
  'light-green': { ink: '#4cb05e', wash: '#4cb05e22', shadow: '#0f9066' },
  red: { ink: '#e03131', wash: '#e0313122', shadow: '#e03131' },
  'light-red': { ink: '#f87777', wash: '#f8777722', shadow: '#e03131' },
  orange: { ink: '#e16919', wash: '#e1691922', shadow: '#e16919' },
  yellow: { ink: '#d9a222', wash: '#f1ac4b2e', shadow: '#d9a222' },
  violet: { ink: '#a044c4', wash: '#a044c422', shadow: '#a044c4' },
  'light-violet': { ink: '#bd54c6', wash: '#bd54c622', shadow: '#a044c4' },
}

export function inkOf(color: BoardColor) {
  return INKS[color] ?? INKS.black
}

/**
 * Type size, in board units.
 *
 * Hierarchy comes from size alone, as it does on a real board — there is one
 * hand and it does not have a bold. These numbers are what lib/mindmap.ts sizes
 * its boxes against, so changing one without the other bursts the labels.
 */
export const TYPE: Record<BoardShape['size'], number> = { s: 19, m: 25, l: 34, xl: 46 }

/** Stroke weight per size, so a heading is written with a fatter pen. */
export const STROKE: Record<BoardShape['size'], number> = { s: 2, m: 2.4, l: 2.9, xl: 3.4 }

/** The dash patterns, in the same names the board language uses. */
export function dashArray(dash: BoardShape['dash'], weight: number) {
  if (dash === 'dashed') return `${weight * 4} ${weight * 3}`
  if (dash === 'dotted') return `0.01 ${weight * 2.6}`
  return undefined
}
