'use client'

import { Tldraw, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'

/**
 * The canvas for the IT engine.
 *
 * Two departures from the whiteboard's board. It runs in tldraw's dark theme,
 * because the whole style is light strokes on black — and in that theme the
 * colour tldraw calls "black" renders near-white, which is what every neutral
 * line here is drawn with. And the grid is off: the reference diagrams sit on
 * an unbroken field, and a grid behind them reads as a design tool rather
 * than as a finished picture.
 *
 * The background is forced past tldraw's own near-black to true black, which
 * is what the saturated actor colours are pitched against.
 */
export default function ITBoard({ onEditor }: { onEditor: (editor: Editor) => void }) {
  return (
    <div className="absolute inset-0 [&_.tl-background]:!bg-black [&_.tl-canvas]:!bg-black">
      <Tldraw
        hideUi
        onMount={(editor) => {
          editor.user.updateUserPreferences({ colorScheme: 'dark' })
          editor.updateInstanceState({ isGridMode: false })
          onEditor(editor)
        }}
      />
    </div>
  )
}
