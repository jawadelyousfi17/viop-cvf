import { isRenderableManimScene, normalizeManimScene, type ManimScene } from './manim-lesson'

/** Newline-delimited events sent from `/api/lesson` to the manim player. */
export type ManimLessonEvent =
  | { type: 'meta'; title: string; summary: string }
  | { type: 'scene'; index: number; scene: ManimScene }
  | { type: 'done'; total: number }
  | { type: 'error'; message: string }

const SCENES_KEY = /"scenes"\s*:\s*\[/

/**
 * Pulls complete scenes out of a JSON document as it is still being written, so
 * the player starts animating scene one while the model writes scene four. Same
 * mechanism as the other engines; only the scene type differs.
 */
export class ManimStreamParser {
  private buffer = ''
  private cursor = -1
  private metaSent = false
  private closed = false

  count = 0

  push(chunk: string): ManimLessonEvent[] {
    this.buffer += chunk
    const events: ManimLessonEvent[] = []

    if (this.cursor === -1) {
      const match = SCENES_KEY.exec(this.buffer)
      if (!match) return events

      if (!this.metaSent) {
        this.metaSent = true
        const meta = parseMeta(this.buffer.slice(0, match.index))
        if (meta) events.push({ type: 'meta', ...meta })
      }
      this.cursor = match.index + match[0].length
    }

    while (!this.closed) {
      const found = nextObject(this.buffer, this.cursor)
      if (!found) break
      if (found.end) {
        this.closed = true
        break
      }

      this.cursor = found.next
      let scene: ManimScene | null = null
      try {
        scene = JSON.parse(found.json) as ManimScene
      } catch {
        continue
      }

      if (!isRenderableManimScene(scene)) continue
      events.push({
        type: 'scene',
        index: this.count,
        scene: normalizeManimScene(scene, this.count),
      })
      this.count++
    }

    return events
  }
}

function parseMeta(prefix: string): { title: string; summary: string } | null {
  try {
    const object = JSON.parse(prefix.replace(/,\s*$/, '') + '}') as {
      title?: string
      summary?: string
    }
    return { title: object.title ?? '', summary: object.summary ?? '' }
  } catch {
    return null
  }
}

/** Finds the next complete top-level object, tracking string/escape state. */
function nextObject(
  text: string,
  from: number
): { json: string; next: number; end?: false } | { end: true } | null {
  let i = from
  while (i < text.length && (text[i] === ',' || /\s/.test(text[i]))) i++
  if (i >= text.length) return null
  if (text[i] === ']') return { end: true }
  if (text[i] !== '{') return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let j = i; j < text.length; j++) {
    const char = text[j]

    if (escaped) {
      escaped = false
      continue
    }
    if (inString && char === '\\') {
      escaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (char === '{') depth++
    else if (char === '}') {
      depth--
      if (depth === 0) return { json: text.slice(i, j + 1), next: j + 1 }
    }
  }

  return null
}
