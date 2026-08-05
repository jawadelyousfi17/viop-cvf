import { isRenderableScene, normalizeScene, type Scene } from './lesson'

/** Newline-delimited events sent from `/api/lesson` to the player. */
export type LessonEvent =
  | { type: 'meta'; title: string; summary: string }
  | { type: 'scene'; index: number; scene: Scene }
  | { type: 'done'; total: number }
  | { type: 'error'; message: string }

const SCENES_KEY = /"scenes"\s*:\s*\[/

/**
 * Pulls complete scenes out of a JSON document as it is still being written.
 *
 * The model emits the lesson in schema order — title, summary, then the scenes
 * array — so each scene object is finished long before the response is. Feeding
 * chunks in here lets the player start drawing scene one while the model is
 * still writing scene four.
 */
export class LessonStreamParser {
  private buffer = ''
  /** Index just past the `[` of the scenes array; -1 until we've seen it. */
  private cursor = -1
  private metaSent = false
  private closed = false
  /** True once title/summary have been read from the finished document. */
  private metaResolved = false

  count = 0

  push(chunk: string): LessonEvent[] {
    this.buffer += chunk
    const events: LessonEvent[] = []

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
      let scene: Scene | null = null
      try {
        scene = JSON.parse(found.json) as Scene
      } catch {
        // A complete-looking object that won't parse means the model produced
        // something malformed; skip it rather than killing the whole lesson.
        continue
      }

      if (!isRenderableScene(scene)) continue
      events.push({ type: 'scene', index: this.count, scene: normalizeScene(scene, this.count) })
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

/** Reads `{"title": ..., "summary": ...,` — the fragment before the scenes array. */
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

/**
 * Finds the next complete top-level object starting at `from`, tracking string
 * and escape state so braces inside narration text don't throw off the depth
 * count. Returns null when the object is still being written.
 */
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
