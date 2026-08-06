import { nextObject, parseMeta, parseWhole } from './json-stream'
import { isRenderableScene, normalizeScene, type ITScene } from './it-lesson'

/** Newline-delimited events sent from `/api/lesson` to the player. */
export type ITLessonEvent =
  | { type: 'meta'; title: string; summary: string }
  | { type: 'scene'; index: number; scene: ITScene }
  | { type: 'done'; total: number }
  | { type: 'error'; message: string }

const SCENES_KEY = /"scenes"\s*:\s*\[/

/**
 * Pulls complete scenes out of the lesson document as it is still being
 * written, so the board can start drawing scene one while the model is still
 * on scene four.
 */
export class ITStreamParser {
  private buffer = ''
  /** Index just past the `[` of the scenes array; -1 until we've seen it. */
  private cursor = -1
  private metaSent = false
  private closed = false
  /** True once title/summary have been read from the finished document. */
  private metaResolved = false

  count = 0

  push(chunk: string): ITLessonEvent[] {
    this.buffer += chunk
    const events: ITLessonEvent[] = []

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
      let scene: ITScene | null = null
      try {
        scene = JSON.parse(found.json) as ITScene
      } catch {
        // A complete-looking object that won't parse means the model produced
        // something malformed; skip it rather than killing the whole lesson.
        continue
      }

      if (!isRenderableScene(scene)) continue
      events.push({ type: 'scene', index: this.count, scene: normalizeScene(scene, this.count) })
      this.count++
    }

    // Structured outputs don't guarantee key order, and these models write the
    // keys alphabetically — so `scenes` arrives before `title`, and the prefix
    // scan above finds nothing. Once the document is complete, read them from
    // the whole thing and send a second meta event.
    if (this.closed && !this.metaResolved) {
      // Only stop retrying once the document actually parses: the closing brace
      // can arrive in a later chunk than the closing bracket.
      const meta = parseWhole(this.buffer)
      if (meta) {
        this.metaResolved = true
        if (meta.title || meta.summary) events.push({ type: 'meta', ...meta })
      }
    }

    return events
  }
}
