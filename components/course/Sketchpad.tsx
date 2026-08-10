'use client'

import { Tldraw, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'

/**
 * The learner's whiteboard.
 *
 * tldraw with its own UI left **on**, unlike `components/whiteboard/board.tsx`
 * where the board is something being drawn *to* and the toolbar would only be
 * in the way. Here the board is the one part of the screen that belongs to the
 * learner, so they need the pen, the eraser and the colours.
 *
 * `persistenceKey` puts the drawing in the browser, which matters more than it
 * looks: someone working through a lesson will reload the page, and a sketch
 * they made to understand closures should not be the price.
 *
 * Nothing draws here but the person watching. When the teacher eventually draws
 * alongside them, it arrives through the editor instance this mounts — the same
 * route `lib/slate-board.ts` already uses to paint a board — so the split is
 * "who holds the pen", not "which component".
 */
/**
 * What of tldraw's own chrome to keep.
 *
 * The toolbar stays — the board is the learner's, and they need the pen, the
 * eraser and undo. The style panel goes, and that is a real trade: it is where
 * you pick a pen colour. But it is a floating panel pinned to the top-right of
 * the canvas, permanently open, covering roughly a quarter of the board — and
 * the board's job is now to hold a diagram the teacher is drawing on it. A
 * quarter of the explanation hidden behind a colour picker is the worse deal.
 *
 * The document and page menus go for a simpler reason: this board is one page
 * of scratch paper beside a lesson, and neither menu leads anywhere useful here.
 */
const CHROME = {
  StylePanel: null,
  MainMenu: null,
  PageMenu: null,
  DebugPanel: null,
} as const

export default function Sketchpad({ onEditor }: { onEditor?: (editor: Editor) => void }) {
  return (
    <Tldraw
      persistenceKey="viop-course-sketchpad"
      components={CHROME}
      licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY}
      onMount={(editor) => {
        onEditor?.(editor)
        // Said explicitly rather than assumed: tldraw keeps the colour scheme
        // as a *user* preference in the browser, so a dark board left behind by
        // another engine follows the learner here.
        editor.user.updateUserPreferences({ colorScheme: 'light' })
        editor.updateInstanceState({ isGridMode: false })
        // The pen, not the select tool. This panel exists to be drawn on, and
        // making that true on arrival saves explaining it.
        editor.setCurrentTool('draw')
      }}
    />
  )
}
