'use client'

import { Tldraw, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'

/**
 * The whiteboard itself. tldraw's own UI is hidden — the lesson controls live
 * in the player's bar instead — but pan, zoom and selection still work, so a
 * learner can wander off and inspect the board mid-lesson.
 */
export default function Board({ onEditor }: { onEditor: (editor: Editor) => void }) {
  return (
    <div className="absolute inset-0">
      <Tldraw
        hideUi
        onMount={(editor) => {
          // The grid gives the board a surface. Without it the shapes float on
          // white and the hand-drawn styling has nothing to sit against.
          editor.updateInstanceState({ isGridMode: true })
          onEditor(editor)
        }}
      />
    </div>
  )
}
