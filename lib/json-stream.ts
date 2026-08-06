/**
 * Reading a JSON document that is still being written.
 *
 * Every engine streams its lesson the same way: the model emits one big JSON
 * object, and the player wants each scene the moment that scene is complete
 * rather than when the response ends. Which means scanning a half-written
 * document for the next balanced object — the same scanner regardless of what
 * the scenes contain.
 *
 * This is the engine-agnostic half of that. The three older engines each carry
 * their own copy; they predate this file and are left alone rather than
 * refactored under an unrelated change.
 */

/** Title and summary from a finished document, wherever they ended up. */
export function parseWhole(buffer: string): { title: string; summary: string } | null {
  try {
    const object = JSON.parse(buffer.trim()) as { title?: string; summary?: string }
    return { title: object.title ?? '', summary: object.summary ?? '' }
  } catch {
    return null
  }
}

/** Reads `{"title": ..., "summary": ...,` — the fragment before the scenes array. */
export function parseMeta(prefix: string): { title: string; summary: string } | null {
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
export function nextObject(
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
