/**
 * Turning a written script into scenes.
 *
 * A script arrives in whatever shape it was written in — a markdown file with
 * the narration in blockquotes, a set of headed sections, or just paragraphs
 * separated by blank lines. Rather than demand one format, this recognises the
 * common ones and falls back to paragraphs, which is what almost anything
 * degrades to.
 *
 * There is no limit on how many scenes come out. The board's own guidance asks
 * a model for five to seven, but that is advice to a writer, not a constraint
 * on the tool: a script with fourteen scenes should import as fourteen.
 */

export interface ParsedScene {
  narration: string
  words: number
}

/** Lines that are structure rather than speech. */
const NOISE =
  /^\s*(#{1,6}\s|\||-{3,}\s*$|\*{3,}\s*$|_{3,}\s*$|```|\[[^\]]+\]:|<!--)/

/** Inline markdown that would otherwise be read aloud. */
function clean(text: string) {
  return text
    .replace(/^\s*>\s?/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|\s)\*(\S[^*]*?)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length

/**
 * The narration blocks in a script, in order.
 *
 * @param minWords blocks shorter than this are treated as headings or notes
 *   rather than speech. Twelve is low enough to keep a terse scene and high
 *   enough to drop "## 3 · Why that mattered".
 */
export function parseScript(source: string, minWords = 12): ParsedScene[] {
  const text = source.replace(/\r\n?/g, '\n')

  // Blockquotes, headings and rules are someone marking scenes deliberately, so
  // they are taken as written. Bare paragraphs are not a scene structure, so
  // those are gathered into scenes that are actually worth drawing against.
  const marked = fromBlockquotes(text) ?? fromHeadings(text) ?? fromRules(text)
  const found = marked ?? group(fromParagraphs(text))

  return found
    .map((block) => clean(block))
    .filter((narration) => countWords(narration) >= minWords)
    .map((narration) => ({ narration, words: countWords(narration) }))
}

/**
 * Blockquotes, which is how a script that was written to be drawn against
 * usually marks the words themselves — everything around them is direction.
 */
function fromBlockquotes(text: string): string[] | null {
  const blocks: string[] = []
  let current: string[] = []

  for (const line of text.split('\n')) {
    if (/^\s*>/.test(line)) {
      current.push(line)
    } else if (current.length) {
      blocks.push(current.join(' '))
      current = []
    }
  }
  if (current.length) blocks.push(current.join(' '))

  // One quote in a document is more likely an epigraph than a script.
  return blocks.length >= 2 ? blocks : null
}

/**
 * Is this line a heading rather than the start of a sentence?
 *
 * A heading is thrown away — only what follows it becomes narration — so
 * getting this wrong deletes someone's writing. That makes the length test the
 * important half of the rule, not the pattern: "Step one:" on its own is a
 * heading, but "Step one: your computer checks its own memory, browser cache
 * first…" is a paragraph that happens to start the same way, and treating it
 * as a heading silently drops the whole step.
 */
function isHeading(line: string) {
  const trimmed = line.trim()
  if (/^#{1,6}\s/.test(trimmed)) return true
  // A standalone scene marker: short, and nothing but the marker.
  return /^(scene|part|step|section)\s+[\w-]+\s*[:·.\-–—]?\s*$/i.test(trimmed)
}

/**
 * Headed sections: `## Scene one`, then the words under it.
 *
 * Tried before rules and paragraphs because a script written this way often
 * has no blank lines at all between the heading and its prose, and splitting
 * on paragraphs would run the whole thing together as one scene.
 */
function fromHeadings(text: string): string[] | null {
  const lines = text.split('\n')
  if (lines.filter(isHeading).length < 2) return null

  const blocks: string[] = []
  let current: string[] = []

  for (const line of lines) {
    if (isHeading(line)) {
      if (current.length) blocks.push(current.join(' '))
      current = []
      continue
    }
    if (line.trim() && !NOISE.test(line)) current.push(line)
  }
  if (current.length) blocks.push(current.join(' '))

  return blocks.length >= 2 ? blocks : null
}

/** What a scene wants to be: long enough to draw against, short enough to hold. */
const TARGET_WORDS = 55
const MAX_WORDS = 80

/**
 * Gathers prose paragraphs into scenes.
 *
 * Only used on the paragraph fallback. Blockquotes and headed sections are
 * someone saying "this is a scene", and regrouping those would be overruling
 * them — but a plain prose script has no scene marks at all, and one paragraph
 * per scene turns a two-sentence aside into its own board.
 *
 * Paragraphs are never split, only joined, so a scene always ends where the
 * writer ended one.
 */
function group(blocks: string[]): string[] {
  const out: string[] = []
  let current = ''

  for (const block of blocks) {
    if (!current) {
      current = block
      continue
    }
    const combined = countWords(current) + countWords(block)
    // Merge while the result still reads as one scene, and prefer merging a
    // short paragraph up rather than leaving it stranded.
    if (combined <= MAX_WORDS || countWords(current) < TARGET_WORDS / 2) {
      current = `${current} ${block}`
    } else {
      out.push(current)
      current = block
    }
  }
  if (current) out.push(current)

  return out
}

/** Sections divided by horizontal rules, with the prose taken from each. */
function fromRules(text: string): string[] | null {
  const parts = text.split(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/m)
  if (parts.length < 3) return null

  return parts
    .map((part) =>
      part
        .split('\n')
        .filter((line) => line.trim() && !NOISE.test(line))
        .join(' ')
    )
    .filter(Boolean)
}

/** The fallback: a blank line ends a scene. */
function fromParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split('\n')
        .filter((line) => line.trim() && !NOISE.test(line))
        .join(' ')
    )
    .filter(Boolean)
}
