import { readFile } from 'node:fs/promises'
import { parseScript } from '@/lib/script-import'

/** Dev helper: the scenes a script file parses into. */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not available.' }, { status: 404 })
  }
  const path = new URL(request.url).searchParams.get('f')
  if (!path) return Response.json({ error: 'Missing f.' }, { status: 400 })
  const text = await readFile(path, 'utf8')
  return Response.json({ scenes: parseScript(text).map((s) => s.narration) })
}
