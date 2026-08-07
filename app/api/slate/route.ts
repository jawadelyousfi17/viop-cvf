import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

/**
 * The Slate examples, read off disk.
 *
 * Same shape as the scripts route and the same guard: only a bare filename from
 * one known directory, matched against a strict pattern, so a name carrying a
 * path cannot read anything else the server can reach.
 */
const DIRECTORY = 'examples'
const ALLOWED = /^[\w.-]+\.(slate|script\.md|md)$/

export async function GET(request: Request) {
  const wanted = new URL(request.url).searchParams.get('name') ?? ''
  const name = basename(wanted)

  if (!ALLOWED.test(name) || name.includes('..')) {
    return new Response('Not found', { status: 404 })
  }

  try {
    const text = await readFile(join(process.cwd(), DIRECTORY, name), 'utf8')
    return new Response(text, {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
