import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { LlmError, streamText } from '@/lib/llm'
import { DEFAULT_PROVIDER, isProvider } from '@/lib/providers'
import { parseScript as parseWrittenScript } from '@/lib/script-import'
import { splitSentences } from '@/lib/slate'
import {
  SLATE_YAML_SYSTEM,
  slateYamlScriptPrompt,
  slateYamlTopicPrompt,
} from '@/lib/slate-yaml-prompt'

export const maxDuration = 300

/**
 * The Slate examples, read off disk.
 *
 * Same shape as the scripts route and the same guard: only a bare filename from
 * one known directory, matched against a strict pattern, so a name carrying a
 * path cannot read anything else the server can reach.
 */
const DIRECTORY = 'examples'
const ALLOWED = /^[\w.-]+\.(slate|ya?ml|script\.md|md)$/

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

/**
 * Writes a board as YAML, streamed.
 *
 * Plain text rather than a forced tool call: YAML is checked by a parser and a
 * linter that were going to run anyway, so wrapping it in a JSON schema would
 * only mean asking for a string inside an object. The client parses as the text
 * arrives, which is why this streams at all — a half-written document still
 * yields the scenes whose mappings have closed.
 */
export async function POST(request: Request) {
  let topic: unknown
  let script: unknown
  let provider: unknown
  let model: unknown
  try {
    ;({ topic, script, provider, model } = await request.json())
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const hasScript = typeof script === 'string' && script.trim().length > 0
  if (!hasScript && (typeof topic !== 'string' || !topic.trim())) {
    return Response.json({ error: 'Give me a topic to teach, or a script to draw.' }, { status: 400 })
  }
  if (hasScript && (script as string).length > 24000) {
    return Response.json(
      { error: 'That script is too long — keep it under 24,000 characters.' },
      { status: 400 }
    )
  }

  const user = hasScript
    ? slateYamlScriptPrompt(
        parseWrittenScript(script as string).map((scene, i) => ({
          n: i + 1,
          sentences: splitSentences(scene.narration),
        }))
      )
    : slateYamlTopicPrompt(String(topic).trim())

  let completion: AsyncGenerator<string>
  try {
    completion = streamText({
      provider: isProvider(provider) ? provider : DEFAULT_PROVIDER,
      model: typeof model === 'string' ? model : undefined,
      system: SLATE_YAML_SYSTEM,
      user,
    })
    // Pulled before the response opens, so a missing key is an error page
    // rather than an empty document.
    const first = await completion.next()
    if (!first.done) completion = prepend(first.value, completion)
  } catch (error) {
    console.error('[slate] request rejected', error)
    if (error instanceof LlmError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `Could not write the board: ${message}` }, { status: 502 })
  }

  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of completion) controller.enqueue(encoder.encode(chunk))
      } catch (error) {
        console.error('[slate] stream failed', error)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  })
}

/** Puts an already-pulled chunk back at the front of a stream. */
async function* prepend(first: string, rest: AsyncGenerator<string>): AsyncGenerator<string> {
  yield first
  yield* rest
}
