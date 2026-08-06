/**
 * Turning a moment in the narration into an anchor phrase.
 *
 * Kept apart from the capture code, which has to run in the browser because it
 * reads tldraw's shapes. This is pure string work over an alignment, so it
 * belongs where anything can call it — the authoring tool, a check, a test.
 */

/**
 * The words being spoken at a given moment.
 *
 * This is the reason the tool works the way it does. An anchor has to appear in
 * the narration character for character, and getting that right by hand is the
 * single most common way a board goes out of sync. But if you draw something
 * while the voice is saying "the long trip to memory", the anchor is not a
 * thing to be typed — it is a thing to be read off the clock.
 *
 * Returns "" when there is no alignment to read, which leaves the shape timed
 * by its fraction, exactly as before.
 */
export function phraseAt(
  alignment: { characters: string[]; starts: number[] } | null,
  seconds: number,
  words = 4
): string {
  if (!alignment?.characters.length) return ''

  const text = alignment.characters.join('')

  // The first character not yet spoken at this moment.
  let index = alignment.starts.findIndex((start) => start > seconds)
  if (index === -1) index = alignment.characters.length - 1
  index = Math.max(0, index - 1)

  // Back up to the start of the word being spoken.
  while (index > 0 && !/\s/.test(text[index - 1])) index--

  // Take a few words forward, stopping at a sentence end so the anchor never
  // straddles two sentences — those read as two different moments.
  let end = index
  let taken = 0
  while (end < text.length && taken < words) {
    const next = text.indexOf(' ', end + 1)
    const stop = next === -1 ? text.length : next
    const chunk = text.slice(end, stop)
    end = stop
    taken++
    if (/[.!?]/.test(chunk)) break
  }

  return text.slice(index, end).trim().replace(/[.,!?;:]+$/, '')
}
