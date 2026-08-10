/**
 * A course lesson, written as markdown.
 *
 * The other engines ask a model for a lesson. A course is the opposite case:
 * the lesson is *written*, checked in, and the same every time — so it is a
 * file, not a generation. That has one consequence worth stating up front,
 * because the whole design follows from it: **the narration text never
 * changes**, so its recording never changes, so it is paid for once and read
 * off disk forever after (see lib/tts-cache.ts). A course you can replay fifty
 * times while building it costs one synthesis.
 *
 * The format is markdown a person would write anyway, plus fenced blocks for
 * the things a teacher *does* — type some code, ask a question, hand the
 * keyboard over. Prose is narration; everything else is direction.
 *
 *     # JavaScript fundamentals
 *     > What the first hour should have told you.
 *
 *     ## A value, and a name for it
 *     Every program moves values around. A name is how you get one back.
 *
 *     ```js write |2 run
 *     const greeting = 'Hello'
 *     ```
 *
 *     ```quiz |4
 *     Q What does `const` actually stop you doing?
 *     = Pointing the name at a different value
 *     - Editing an object the name holds
 *     > It freezes the binding, not the value.
 *     ```
 *
 * **Beats are sentence numbers.** A block carries `|3`, meaning "on the third
 * sentence of this step". This is the one idea the rest of the repo arrived at
 * the hard way (docs/slate.md §3): an anchor written as a *phrase* fails
 * silently when it misses, and drew on the wrong beat with nothing to say so.
 * A number is either in range or it is a build error, and `parse` reports it.
 */

import { parseBoard, type BoardItem } from './course-board'

/** Blocks that are direction rather than narration. */
export type ActionKind = 'seed' | 'write' | 'quiz' | 'task' | 'point' | 'draw'

export interface QuizOption {
  text: string
  correct: boolean
}

export interface CourseAction {
  kind: ActionKind
  /** 1-based sentence index within the step. `seed` uses 0: already there. */
  beat: number
  /** `write` and `seed`: what goes in the editor. */
  code?: string
  /** `write`: run it once the last character is typed. */
  run?: boolean
  /** `quiz`. */
  question?: string
  options?: QuizOption[]
  /** Shown after answering, right or wrong. The reason it is the answer. */
  because?: string
  /** `task`: what the learner is asked to do. */
  prompt?: string
  /**
   * `task`: a regular expression the program's output must match. Absent means
   * "just run it" — pressing Run is the whole exercise.
   */
  expect?: string
  /** `point`: which editor lines to hold up, 1-based and inclusive. */
  lines?: [number, number]
  /** `point`: what is being pointed at — the code, or what it printed. */
  target?: 'code' | 'output'
  /** `point`: a few words in the margin saying why. */
  label?: string
  /** `draw`: what the teacher puts on the whiteboard, each part on its beat. */
  board?: BoardItem[]
  line: number
}

export interface CourseBeat {
  /** Sent to the voice, delivery tags and all. */
  text: string
  /** Shown as a caption, with the tags taken out. */
  shown: string
}

export interface CourseStep {
  n: number
  title: string
  beats: CourseBeat[]
  /** Everything the voice says in this step, which is what gets synthesised. */
  narration: string
  actions: CourseAction[]
}

export interface CourseProblem {
  line: number
  message: string
  severity: 'error' | 'warning'
}

export interface Course {
  slug: string
  title: string
  takeaway: string
  steps: CourseStep[]
  problems: CourseProblem[]
}

/**
 * ElevenLabs v3 performs `[bracketed]` cues instead of speaking them, so the
 * narration carries direction the caption must not show. The voice gets the
 * text as written; the screen gets this.
 */
export function stripTags(text: string) {
  return text
    .replace(/\[[^\]\n]{1,40}\]/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Sentence boundaries.
 *
 * Deliberately the same rule as `splitSentences` in lib/slate.ts rather than an
 * import: a course sentence may open with a delivery tag (`[warmly] So…`), and
 * a splitter that does not know that treats the bracket as the start of the
 * sentence and never matches the capital after it.
 */
export function splitBeats(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+(?=[A-Z"“'(\[\d])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

/** `js write |2 run` → its parts. Order after the kind does not matter. */
function readInfo(info: string) {
  const words = info.trim().split(/\s+/).filter(Boolean)
  const beat = words.find((word) => word.startsWith('|')) ?? null
  return {
    words,
    beat,
    has: (flag: string) => words.includes(flag),
  }
}

/** A fence's opening line tells us which kind of block it is, if any. */
function kindOf(words: string[]): ActionKind | null {
  if (words.includes('write')) return 'write'
  if (words.includes('seed')) return 'seed'
  if (words[0] === 'quiz') return 'quiz'
  if (words[0] === 'task') return 'task'
  if (words[0] === 'point') return 'point'
  if (words[0] === 'draw') return 'draw'
  return null
}

interface RawBlock {
  kind: ActionKind
  info: ReturnType<typeof readInfo>
  body: string[]
  line: number
}

interface RawStep {
  title: string
  prose: string[]
  blocks: RawBlock[]
  line: number
}

/**
 * Markdown in, a lesson out.
 *
 * Never throws. A malformed block is reported and dropped, because one bad
 * quiz should cost one quiz and not the lesson — the same bargain
 * `lib/chalk.ts` makes, and for the same reason: these files are edited live
 * while the audio is playing.
 */
export function parseCourse(source: string, slug: string): Course {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const problems: CourseProblem[] = []
  const fail = (line: number, message: string) =>
    problems.push({ line, message, severity: 'error' })
  const warn = (line: number, message: string) =>
    problems.push({ line, message, severity: 'warning' })

  let title = ''
  let takeaway = ''
  const steps: RawStep[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const number = i + 1

    // A fence, wherever it appears. Consumed here so its contents can never be
    // mistaken for prose — a Dockerfile line beginning with "> " is not a
    // takeaway, and a blank line inside code does not end a paragraph.
    const fence = /^\s*```(.*)$/.exec(line)
    if (fence) {
      const info = readInfo(fence[1])
      const body: string[] = []
      let closed = false
      for (i++; i < lines.length; i++) {
        if (/^\s*```\s*$/.test(lines[i])) {
          closed = true
          break
        }
        body.push(lines[i])
      }
      if (!closed) fail(number, 'A fenced block is never closed.')

      const kind = kindOf(info.words)
      if (!kind) {
        // An ordinary markdown code block: illustration in the file, not
        // direction to the player. Dropped rather than spoken.
        continue
      }
      if (!steps.length) {
        fail(number, `A \`${kind}\` block before the first \`##\` step.`)
        continue
      }
      steps[steps.length - 1].blocks.push({ kind, info, body, line: number })
      continue
    }

    const heading = /^##\s+(.*)$/.exec(line)
    if (heading) {
      steps.push({ title: clean(heading[1]), prose: [], blocks: [], line: number })
      continue
    }

    const lesson = /^#\s+(.*)$/.exec(line)
    if (lesson) {
      title = clean(lesson[1])
      continue
    }

    // The takeaway, and only before the first step — after that a `>` is prose
    // someone quoted.
    const quote = /^>\s?(.*)$/.exec(line)
    if (quote && !steps.length) {
      takeaway = takeaway ? `${takeaway} ${clean(quote[1])}` : clean(quote[1])
      continue
    }

    if (!line.trim()) continue
    if (/^\s*(-{3,}|<!--)/.test(line)) continue
    if (steps.length) steps[steps.length - 1].prose.push(line.trim())
  }

  if (!title) warn(1, 'The lesson has no `# title`.')
  if (!steps.length) fail(1, 'The lesson has no `## steps`.')

  const built = steps.map((step, index) =>
    buildStep(step, index + 1, { fail, warn })
  )

  return { slug, title, takeaway, steps: built, problems }
}

function buildStep(
  raw: RawStep,
  n: number,
  report: {
    fail: (line: number, message: string) => void
    warn: (line: number, message: string) => void
  }
): CourseStep {
  const narration = raw.prose.join(' ').replace(/\s+/g, ' ').trim()
  const beats = splitBeats(narration).map((text) => ({ text, shown: stripTags(text) }))

  if (!beats.length) report.warn(raw.line, `Step ${n} “${raw.title}” says nothing.`)

  const actions: CourseAction[] = []
  // `|+` means "the beat after the last one anchored", so inserting a sentence
  // does not renumber the file. Same walking form as Slate's, and the same
  // reason: hand-numbered beats are correct exactly until the script is edited.
  let previous = 0

  for (const block of raw.blocks) {
    const beat = resolveBeat(block, previous, beats.length, n, raw.title, report)
    if (beat === null) continue
    if (block.kind !== 'seed') previous = beat

    const action = makeAction(block, beat, n, raw.title, beats.length, report)
    if (action) actions.push(action)
  }

  // Order matters at playback: everything on a beat fires in the order written.
  actions.sort((a, b) => a.beat - b.beat || a.line - b.line)

  return { n, title: raw.title, beats, narration, actions }
}

function resolveBeat(
  block: RawBlock,
  previous: number,
  last: number,
  n: number,
  title: string,
  report: { fail: (line: number, message: string) => void }
): number | null {
  const where = `step ${n} “${title}”`

  // A seed is the state the editor starts in, not something that happens.
  if (block.kind === 'seed') return 0

  const token = block.info.beat
  if (!token) {
    report.fail(block.line, `${where}: a \`${block.kind}\` block with no \`|beat\`.`)
    return null
  }

  const body = token.slice(1)
  const beat = /^\++$/.test(body) ? previous + body.length : Number(body)

  if (!Number.isInteger(beat) || beat < 1) {
    report.fail(block.line, `${where}: \`${token}\` is not a beat.`)
    return null
  }
  if (beat > last) {
    report.fail(
      block.line,
      `${where}: beat ${beat} is past the last beat (${last}).`
    )
    return null
  }
  return beat
}

function makeAction(
  block: RawBlock,
  beat: number,
  n: number,
  title: string,
  lastBeat: number,
  report: {
    fail: (line: number, message: string) => void
    warn: (line: number, message: string) => void
  }
): CourseAction | null {
  const where = `step ${n} “${title}”`
  const base = { beat, line: block.line }

  /**
   * The whiteboard for this section.
   *
   * One block per section, holding the whole diagram. Its parts carry their own
   * beats, so the picture assembles itself alongside the narration rather than
   * appearing finished while the voice is still on the first sentence — the
   * mistake `docs/slate.md` §6 calls the language's largest single loss of
   * quality.
   */
  if (block.kind === 'draw') {
    const { items, problems } = parseBoard(block.body, beat, lastBeat, block.line)
    for (const problem of problems) report.fail(problem.line, `${where}: ${problem.message}`)
    if (!items.length) {
      report.fail(block.line, `${where}: a \`draw\` block with nothing on it.`)
      return null
    }
    // The action fires at its earliest part; the rest follow on their own beats.
    const first = Math.min(...items.map((item) => item.beat))
    return { ...base, kind: 'draw', beat: first, board: items }
  }

  if (block.kind === 'write' || block.kind === 'seed') {
    const code = trimBlank(block.body).join('\n')
    if (!code.trim()) {
      report.fail(block.line, `${where}: an empty \`${block.kind}\` block.`)
      return null
    }
    return { ...base, kind: block.kind, code, run: block.info.has('run') }
  }

  if (block.kind === 'quiz') {
    let question = ''
    let because = ''
    const options: QuizOption[] = []

    for (const line of block.body) {
      const text = line.trim()
      if (!text) continue
      if (text.startsWith('Q ')) question = clean(text.slice(2))
      else if (text.startsWith('= ')) options.push({ text: clean(text.slice(2)), correct: true })
      else if (text.startsWith('- ')) options.push({ text: clean(text.slice(2)), correct: false })
      else if (text.startsWith('> ')) because = clean(text.slice(2))
      else report.warn(block.line, `${where}: a quiz line starting “${text.slice(0, 20)}” was ignored.`)
    }

    if (!question) {
      report.fail(block.line, `${where}: a quiz with no \`Q\` question.`)
      return null
    }
    if (!options.some((option) => option.correct)) {
      report.fail(block.line, `${where}: a quiz with no \`=\` right answer.`)
      return null
    }
    if (options.length < 2) {
      report.fail(block.line, `${where}: a quiz needs an answer to be wrong too.`)
      return null
    }
    return { ...base, kind: 'quiz', question, options, because }
  }

  /**
   * Pointing at what is being talked about.
   *
   * The narration says "notice there is no `let` on the second line" and the
   * learner's eye has nowhere to go — twelve lines of code all look equally
   * relevant. Every board language in this repo learned the same lesson
   * (`focus`, `hl`, `ring` in docs/slate.md §9): most of what a teacher at a
   * board actually does is point at something already there.
   *
   *     ```point |2 lines=2-3
   *     no `let` — this is a reassignment
   *     ```
   */
  if (block.kind === 'point') {
    const target = block.info.has('out') || block.info.has('output') ? 'output' : 'code'
    const spec = block.info.words.find((word) => word.startsWith('lines='))?.slice(6)
    let lines: [number, number] | undefined

    if (spec) {
      const [from, to] = spec.split(/[-–]/, 2)
      const start = Number(from)
      const end = to === undefined ? start : Number(to)
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
        report.fail(block.line, `${where}: \`lines=${spec}\` is not a line range.`)
        return null
      }
      lines = [start, end]
    } else if (target === 'code') {
      report.fail(block.line, `${where}: a \`point\` at the code with no \`lines=\`.`)
      return null
    }

    const label = trimBlank(block.body).map((text) => text.trim()).filter(Boolean).join(' ')
    return { ...base, kind: 'point', target, lines, label: clean(label) || undefined }
  }

  // task
  const prompt: string[] = []
  let expect: string | undefined
  for (const line of block.body) {
    const text = line.trim()
    if (!text) continue
    const rule = /^expect\s+\/(.*)\/([a-z]*)$/.exec(text)
    if (rule) {
      try {
        new RegExp(rule[1], rule[2])
        expect = rule[1]
      } catch {
        report.fail(block.line, `${where}: \`expect /${rule[1]}/\` is not a valid pattern.`)
      }
      continue
    }
    prompt.push(text)
  }

  if (!prompt.length) {
    report.fail(block.line, `${where}: a task that does not say what to do.`)
    return null
  }
  return { ...base, kind: 'task', prompt: prompt.join(' '), expect }
}

/** Inline markdown that would otherwise be read aloud character by character. */
function clean(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim()
}

/** Blank lines at either end of a code block, which are formatting, not code. */
function trimBlank(body: string[]) {
  let from = 0
  let to = body.length
  while (from < to && !body[from].trim()) from++
  while (to > from && !body[to - 1].trim()) to--
  return body.slice(from, to)
}

/**
 * Everything the voice will be asked to say, in order.
 *
 * One entry per step, which is one synthesis request per step — the same
 * granularity the other engines use, and the reason a lesson can start playing
 * before the whole thing has been spoken.
 */
export function narrationOf(course: Course) {
  return course.steps.map((step) => step.narration).filter(Boolean)
}

export const hasErrors = (course: Course) =>
  course.problems.some((problem) => problem.severity === 'error')
