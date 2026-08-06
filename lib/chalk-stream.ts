import { compileChalk, type ChalkError, type ChalkOptions } from './chalk'
import { normalizeScene, type Scene } from './lesson'

/** Newline-delimited events, the same shape the board's other engines send. */
export type ChalkEvent =
  | { type: 'meta'; title: string; summary: string }
  | { type: 'scene'; index: number; scene: Scene }
  | { type: 'done'; total: number }
  | { type: 'error'; message: string }

/**
 * Reads Chalk as it is being written, handing over each scene the moment it is
 * finished.
 *
 * The JSON engines have to scan for balanced braces to know where a scene ends.
 * Chalk has a line that says so — a scene is complete once the next `---`
 * arrives, or once the stream does. That is the whole parser.
 *
 * It recompiles the buffer on each chunk rather than keeping half-parsed state
 * of its own. Compiling is microseconds against a network round trip, and one
 * parser that is always used the same way cannot drift from a second one that
 * is only used while streaming.
 */
export class ChalkStreamParser {
  private buffer = ''
  private sent = 0
  private metaSent = false

  constructor(private readonly options: ChalkOptions = {}) {}

  /** Everything the compiler complained about, once the stream has ended. */
  errors: ChalkError[] = []

  push(chunk: string): ChalkEvent[] {
    this.buffer += chunk
    return this.harvest(false)
  }

  /** Called when the model has stopped writing: the last scene is now complete. */
  end(): ChalkEvent[] {
    const events = this.harvest(true)
    events.push({ type: 'done', total: this.sent })
    return events
  }

  private harvest(finished: boolean): ChalkEvent[] {
    const events: ChalkEvent[] = []

    // A scene is only finished when something after it proves it is. While the
    // stream is open that means a later `---`; at the end, everything counts.
    const complete = finished ? this.buffer : cutAtLastSceneBreak(this.buffer)
    if (!complete) return events

    const { lesson, errors } = compileChalk(complete, this.options)
    this.errors = errors

    // Title and summary sit at the top, so they are known long before scene
    // one — worth sending early, since the player shows them while it waits.
    if (!this.metaSent && (lesson.title || lesson.summary)) {
      this.metaSent = true
      events.push({ type: 'meta', title: lesson.title, summary: lesson.summary })
    }

    for (let i = this.sent; i < lesson.scenes.length; i++) {
      events.push({ type: 'scene', index: i, scene: normalizeScene(lesson.scenes[i], i) })
    }
    this.sent = Math.max(this.sent, lesson.scenes.length)

    return events
  }
}

/**
 * The document up to the last scene break, which is the part that can no longer
 * change. Anything after it is still being written.
 */
function cutAtLastSceneBreak(buffer: string) {
  const at = buffer.lastIndexOf('\n---')
  return at === -1 ? '' : buffer.slice(0, at + 1)
}
