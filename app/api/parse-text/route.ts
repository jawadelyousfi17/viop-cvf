import { parseScript } from '@/lib/script-import'

/**
 * The scenes a script parses into.
 *
 * Takes the text rather than a path on purpose: the earlier version of this
 * read whatever file it was pointed at, which is an arbitrary-file-read behind
 * nothing but a NODE_ENV check.
 */
export async function POST(request: Request) {
  let text: unknown
  try {
    ;({ text } = await request.json())
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }
  if (typeof text !== 'string' || !text.trim()) {
    return Response.json({ error: 'Missing text.' }, { status: 400 })
  }
  if (text.length > 200_000) {
    return Response.json({ error: 'That script is too long.' }, { status: 413 })
  }
  return Response.json({ scenes: parseScript(text).map((scene) => scene.narration) })
}
