import { isRenderableMathScene, normalizeMathScene, type MathScene } from './math-lesson'

/** Newline-delimited events sent from `/api/lesson` to the notebook player. */
export type MathLessonEvent =
  | { type: 'meta'; title: string; summary: string }
  /** How many pages the script comes to, whether or not they are all coming. */
  | { type: 'plan'; total: number }
  | { type: 'scene'; index: number; scene: MathScene }
  | { type: 'done'; total: number }
  | { type: 'error'; message: string }

const SCENES_KEY = /"scenes"\s*:\s*\[/

/**
 * Pulls complete scenes out of a JSON document as it is still being written, so
 * the player starts on page one while the model is still writing page four. Same
 * mechanism as the other engines; only the scene type differs.
 */
export class MathStreamParser {
  private buffer = ''
  private cursor = -1
  private metaSent = false
  private closed = false
  /** True once title/summary have been read from the finished document. */
  private metaResolved = false

  count = 0

  push(chunk: string): MathLessonEvent[] {
    this.buffer += chunk
    const events: MathLessonEvent[] = []

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
      let scene: MathScene | null = null
      try {
        scene = JSON.parse(found.json) as MathScene
      } catch {
        continue
      }

      if (!isRenderableMathScene(scene)) continue
      events.push({
        type: 'scene',
        index: this.count,
        scene: normalizeMathScene(scene, this.count),
      })
      this.count++
    }

    // Structured outputs don't guarantee key order, and this model writes the
    // keys alphabetically — so `scenes` arrives before `title` and `summary`,
    // and the prefix scan above finds nothing. Once the document is complete,
    // read them from the whole thing and send a second meta event.
    if (this.closed && !this.metaResolved) {
      // Only give up retrying once the document actually parses — the closing
      // brace can arrive in a later chunk than the closing bracket.
      const meta = parseWhole(this.buffer)
      if (meta) {
        this.metaResolved = true
        if (meta.title || meta.summary) events.push({ type: 'meta', ...meta })
      }
    }

    return events
  }
}

/** Title and summary from the finished document, wherever they ended up. */
function parseWhole(buffer: string): { title: string; summary: string } | null {
  try {
    const object = JSON.parse(buffer.trim()) as { title?: string; summary?: string }
    return { title: object.title ?? '', summary: object.summary ?? '' }
  } catch {
    return null
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
