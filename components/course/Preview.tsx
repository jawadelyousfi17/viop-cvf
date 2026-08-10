'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Where the learner's code actually runs.
 *
 * A sandboxed iframe with `allow-scripts` and, deliberately, **not**
 * `allow-same-origin`. Those two together are the same as no sandbox at all —
 * the frame could reach into this document and remove its own sandbox
 * attribute. Withholding same-origin puts the code on a null origin, so it
 * cannot read this page, its storage or its cookies, and the only way back is
 * `postMessage`.
 *
 * The code is never interpolated into the frame's HTML. The document is a fixed
 * harness with nothing of the learner's in it, and their code arrives afterwards
 * as a message — which means there is no string to escape and therefore no way
 * to break out of a template by typing `</script>` into the editor.
 *
 * Every run remounts the frame. That is not tidiness: it is how a run gets a
 * clean global object and an empty DOM, and it is the only thing that reliably
 * stops a `while (true)` from the previous attempt, since a spinning frame will
 * not process messages but will still be torn down.
 */

export interface RunResult {
  /** Everything the program printed, one line per entry. */
  output: string[]
  /** True when it threw. The message is the last output line. */
  failed: boolean
}

/** Fixed. Contains nothing from the learner, so there is nothing to escape. */
const HARNESS = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  :root { color-scheme: light }
  body {
    margin: 0; padding: 14px 16px;
    font: 15px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #1f2328; background: #fff;
  }
  .line { white-space: pre-wrap; word-break: break-word; padding: 1px 0 }
  .warn { color: #8a5a00 }
  .error { color: #b42318 }
  .muted { color: #8c959f }
</style></head><body><script>
(function () {
  var out = []
  function print(level, text) {
    out.push(text)
    var node = document.createElement('div')
    node.className = 'line ' + level
    node.textContent = text
    document.body.appendChild(node)
  }
  function show(value, depth) {
    if (typeof value === 'string') return depth ? JSON.stringify(value) : value
    if (typeof value === 'function') return '[Function' + (value.name ? ': ' + value.name : '') + ']'
    if (typeof value === 'bigint') return value + 'n'
    if (value === null || value === undefined || typeof value !== 'object') return String(value)
    if (depth > 3) return Array.isArray(value) ? '[Array]' : '[Object]'
    if (Array.isArray(value)) return '[ ' + value.map(function (v) { return show(v, depth + 1) }).join(', ') + ' ]'
    if (value instanceof Error) return value.name + ': ' + value.message
    var keys = Object.keys(value)
    if (!keys.length) return '{}'
    return '{ ' + keys.map(function (k) { return k + ': ' + show(value[k], depth + 1) }).join(', ') + ' }'
  }
  function say(level) {
    return function () {
      var parts = []
      for (var i = 0; i < arguments.length; i++) parts.push(show(arguments[i], 0))
      print(level, parts.join(' '))
    }
  }
  console.log = say('log'); console.info = say('log'); console.debug = say('log')
  console.warn = say('warn'); console.error = say('error')

  function finish(failed) {
    parent.postMessage({ source: 'viop-run', output: out, failed: !!failed }, '*')
  }

  window.addEventListener('message', function (event) {
    if (!event.data || event.data.source !== 'viop-code') return
    try {
      // Indirect, so the learner's code gets the global scope and not this
      // closure — a 'var out' of their own must not shadow the harness's.
      new Function(event.data.code)()
      finish(false)
    } catch (error) {
      print('error', (error && error.name ? error.name + ': ' + error.message : String(error)))
      finish(true)
    }
  })

  window.onerror = function (message) { print('error', String(message)); finish(true) }
  parent.postMessage({ source: 'viop-ready' }, '*')
})()
</script></body></html>`

export function Preview({
  code,
  runId,
  onResult,
  marked,
}: {
  code: string
  /** Bumped by the parent to ask for a run. Zero means nothing has run yet. */
  runId: number
  onResult: (result: RunResult) => void
  /** The teacher is talking about what this printed, not about the code. */
  marked?: boolean
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  // The run this frame has finished. Derived into "running" rather than kept as
  // its own flag, so the indicator cannot disagree with what is on screen.
  const [finished, setFinished] = useState(0)
  const running = runId > 0 && finished !== runId
  const runIdRef = useRef(runId)

  // Read inside the message handler so a re-render never sends stale code, and
  // so the handler itself does not need re-binding on every keystroke. Kept up
  // to date from effects rather than during render — a ref written while
  // rendering is a value React has not committed to yet.
  const latest = useRef(code)
  const result = useRef(onResult)

  useEffect(() => {
    latest.current = code
  }, [code])

  useEffect(() => {
    result.current = onResult
  }, [onResult])

  useEffect(() => {
    runIdRef.current = runId
  }, [runId])

  const receive = useCallback((event: MessageEvent) => {
    // The frame has a null origin, so identity is the window itself, which is
    // the check that actually means something here.
    if (!frame.current || event.source !== frame.current.contentWindow) return
    const data = event.data as
      | { source: 'viop-ready' }
      | { source: 'viop-run'; output: string[]; failed: boolean }
      | undefined

    if (data?.source === 'viop-ready') {
      frame.current.contentWindow?.postMessage(
        { source: 'viop-code', code: latest.current },
        '*'
      )
      return
    }
    if (data?.source === 'viop-run') {
      setFinished(runIdRef.current)
      result.current({ output: data.output ?? [], failed: !!data.failed })
    }
  }, [])

  useEffect(() => {
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [receive])

  return (
    <div className={`preview${marked ? ' marked' : ''}`}>
      <div className="pane-bar">
        <span className="pane-name">Output</span>
        {running ? <span className="pane-note">running…</span> : null}
        {marked ? <span className="pane-flag">look here</span> : null}
      </div>
      {runId === 0 ? (
        <div className="preview-empty">Press Run to see what this does.</div>
      ) : (
        <iframe
          // Remounting on every run is what gives the code a clean global.
          key={runId}
          ref={frame}
          className="preview-frame"
          title="Program output"
          sandbox="allow-scripts"
          srcDoc={HARNESS}
        />
      )}
    </div>
  )
}
