'use client'

import { useEffect, useMemo, useRef } from 'react'
import { highlight } from '@/lib/slate-code'

/**
 * The editor.
 *
 * A textarea with a highlighted `<pre>` behind it, rather than CodeMirror or
 * Monaco. Those are three hundred kilobytes and a lifecycle of their own to
 * solve a problem this lesson does not have: nothing here needs a language
 * server, a linter, folding or multiple cursors. It needs coloured tokens and a
 * caret.
 *
 * The colouring is `lib/slate-code.ts`, already in the repo for the board's
 * `code` block — one tokenizer, so a Dockerfile on a Slate board and a function
 * in this editor are coloured by the same rules.
 *
 * The two layers have to agree on metrics exactly or the caret drifts from the
 * text under it, which is why font, size, line height, padding, tabs and
 * wrapping are all set from one place below and the `<pre>` mirrors the
 * textarea's scroll rather than scrolling on its own.
 */
/** Must match `--editor-line` and `--editor-pad` in course.css exactly. */
const LINE = 26
const PAD = 14

export function Editor({
  value,
  onChange,
  readOnly,
  onRun,
  point,
}: {
  value: string
  onChange: (next: string) => void
  readOnly: boolean
  onRun: () => void
  /** The lines the teacher is currently talking about, 1-based inclusive. */
  point: { lines: [number, number]; label?: string } | null
}) {
  const area = useRef<HTMLTextAreaElement>(null)
  const back = useRef<HTMLPreElement>(null)

  const lines = useMemo(() => value.split('\n'), [value])

  // Clamped, because the narration is written against the code the *teacher*
  // types — and the learner may have deleted half of it by the time the point
  // lands. A band hanging in space below the last line reads as a bug.
  const band = useMemo(() => {
    if (!point) return null
    const from = Math.min(point.lines[0], lines.length)
    const to = Math.min(point.lines[1], lines.length)
    if (from < 1 || to < from) return null
    return { from, to, top: PAD + (from - 1) * LINE, height: (to - from + 1) * LINE }
  }, [point, lines.length])

  /** Is this 1-based line one of the ones being pointed at? */
  const lit = (n: number) => !!band && n >= band.from && n <= band.to

  // Following the caret is the textarea's job; the layer behind it just has to
  // stay level. Done on the event rather than in React state so it happens in
  // the same frame as the scroll and never lags a repaint behind.
  const sync = () => {
    if (!area.current || !back.current) return
    back.current.scrollTop = area.current.scrollTop
    back.current.scrollLeft = area.current.scrollLeft
  }

  // The teacher types by replacing `value`, so the view has to follow the text
  // down as it grows — otherwise a block longer than the pane finishes writing
  // itself somewhere off screen.
  useEffect(() => {
    if (!readOnly || !area.current) return
    area.current.scrollTop = area.current.scrollHeight
    sync()
  }, [value, readOnly])

  // Pointing at a line nobody can see is not pointing at it. Only scrolls when
  // the band is actually out of view, so a point at line two of a short file
  // does not jump the pane for no reason.
  useEffect(() => {
    const element = area.current
    if (!band || !element) return
    const { scrollTop, clientHeight } = element
    if (band.top < scrollTop + PAD) element.scrollTop = Math.max(0, band.top - PAD)
    else if (band.top + band.height > scrollTop + clientHeight - PAD) {
      element.scrollTop = band.top + band.height - clientHeight + PAD
    }
    sync()
  }, [band])

  return (
    // `pointing` is what pushes every unpointed line back. Dimming the rest is
    // a far stronger signal than brightening one line, and it is the same move
    // `focus` makes in docs/slate.md §9 — the hand on the board lifts one thing
    // and puts everything else behind it.
    <div className={`editor${band ? ' pointing' : ''}`}>
      <div className="editor-gutter" aria-hidden>
        {lines.map((_, i) => (
          <span key={i} className={lit(i + 1) ? 'lit' : undefined}>
            {i + 1}
          </span>
        ))}
      </div>

      <div className="editor-code">
        <pre className="editor-back" ref={back} aria-hidden>
          {/* Inside the scrolling layer, so it travels with the code it marks
              rather than hovering over whatever happens to be at that height. */}
          {band ? (
            <div className="editor-point" style={{ top: band.top, height: band.height }}>
              {point?.label ? <span className="editor-point-label">{point.label}</span> : null}
            </div>
          ) : null}
          {lines.map((line, i) => (
            <div key={i} className={`editor-line${lit(i + 1) ? ' lit' : ''}`}>
              {highlight(line).map((token, j) => (
                <span key={j} className={token.kind ? `tok tok-${token.kind}` : undefined}>
                  {token.text}
                </span>
              ))}
              {/* A line with nothing on it still has to occupy one. */}
              {line === '' ? '​' : ''}
            </div>
          ))}
        </pre>

        <textarea
          ref={area}
          className="editor-input"
          value={value}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Code editor"
          onScroll={sync}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // Cmd/Ctrl-Enter runs, the way every notebook and console does.
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              onRun()
              return
            }
            // Tab indents instead of leaving the editor. The escape hatch is
            // Escape-then-Tab, which is what screen reader users expect.
            if (event.key === 'Tab' && !event.shiftKey) {
              event.preventDefault()
              const element = event.currentTarget
              const { selectionStart, selectionEnd } = element
              const next =
                value.slice(0, selectionStart) + '  ' + value.slice(selectionEnd)
              onChange(next)
              requestAnimationFrame(() => {
                element.selectionStart = element.selectionEnd = selectionStart + 2
              })
            }
          }}
        />
      </div>
    </div>
  )
}
