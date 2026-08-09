import { parseScript } from '@/lib/script-import'
import { DEFAULT_PROVIDER, isProvider } from '@/lib/providers'
import { LlmError, streamStructured } from '@/lib/llm'
import { LESSON_JSON_SCHEMA } from '@/lib/lesson'
import { LessonStreamParser } from '@/lib/lesson-stream'
import { SYSTEM_PROMPT, scriptPrompt, userPrompt } from '@/lib/prompt'

export const maxDuration = 300

const config = {
  system: SYSTEM_PROMPT,
  user: userPrompt,
  script: scriptPrompt,
  schema: LESSON_JSON_SCHEMA,
  parser: () => new LessonStreamParser(),
}

/**
 * Streams a lesson as newline-delimited JSON events. The model writes scenes
 * in order, so the player receives scene one within a few seconds and starts
 * playing it while the rest is still being written.
 */
export async function POST(request: Request) {
  let topic: unknown
  let script: unknown
  let history: unknown
  let provider: unknown
  let model: unknown
  let from: unknown
  let count: unknown
  try {
    ;({ topic, script, history, provider, model, from, count } = await request.json())
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const hasScript = typeof script === 'string' && script.trim().length > 0

  if (!hasScript && (typeof topic !== 'string' || !topic.trim())) {
    return Response.json({ error: 'Give me a topic to teach, or a script to draw.' }, { status: 400 })
  }
  if (typeof topic === 'string' && topic.length > 500) {
    return Response.json(
      { error: 'That topic is too long — keep it under 500 characters.' },
      { status: 400 }
    )
  }
  // A long script is a long lesson, not an error, but there is a ceiling on
  // what one request can plan coherently.
  if (hasScript && (script as string).length > 24000) {
    return Response.json(
      { error: 'That script is too long — keep it under 24,000 characters.' },
      { status: 400 }
    )
  }

  const past = Array.isArray(history)
    ? history
        .filter((h) => h && typeof h.title === 'string')
        .slice(-6)
        .map((h) => ({ title: String(h.title), summary: String(h.summary ?? '') }))
    : []

  let userPrompt: string
  // How many scenes the whole script comes to, whatever slice of it was asked
  // for. Sent to the client so it knows what is left to draw.
  let planned = 0

  if (hasScript && config.script) {
    const blocks = parseScript(script as string).map((scene) => scene.narration)
    if (!blocks.length) {
      return Response.json(
        { error: 'No narration found in that script. Separate scenes with blank lines.' },
        { status: 400 }
      )
    }
    planned = blocks.length

    // A window is a request for part of the script. Absent, the whole thing is
    // drawn in one call, which is what a pasted script has always done.
    const start = Math.max(0, Math.min(blocks.length - 1, Math.trunc(num(from, 0))))
    const wanted = Math.max(1, Math.trunc(num(count, blocks.length)))
    const windowed = start > 0 || wanted < blocks.length

    userPrompt = windowed
      ? config.script(blocks.slice(start, start + wanted), past, {
          from: start,
          total: blocks.length,
          previous: start > 0 ? blocks[start - 1] : undefined,
        })
      : config.script(blocks, past)
  } else {
    userPrompt = config.user(String(topic ?? '').trim(), past)
  }

  // Started before the response stream opens, so a missing key or a rejected
  // request is still an error page rather than an empty lesson.
  let completion: AsyncGenerator<string>
  try {
    completion = streamStructured({
      provider: isProvider(provider) ? provider : DEFAULT_PROVIDER,
      model: typeof model === 'string' ? model : undefined,
      system: config.system,
      user: userPrompt,
      schema: config.schema,
    })
    const first = await completion.next()
    if (!first.done) completion = prepend(first.value, completion)
  } catch (error) {
    console.error('[lesson] request rejected', error)
    if (error instanceof LlmError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `Could not generate the lesson: ${message}` }, { status: 502 })
  }

  const encoder = new TextEncoder()

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))

      const parser = config.parser()

      // Told before anything is drawn, so the player can offer the rest of a
      // script it has only been given the first scene of.
      if (planned) send({ type: 'plan', total: planned })

      try {
        for await (const delta of completion) {
          if (delta) for (const event of parser.push(delta)) send(event)
        }

        if (parser.count === 0) {
          send({ type: 'error', message: 'The model returned a lesson with no scenes.' })
        } else {
          send({ type: 'done', total: parser.count })
        }
      } catch (error) {
        console.error('[lesson] stream failed', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        send({ type: 'error', message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(body, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  })
}

function num(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Puts an already-pulled chunk back at the front of a stream. */
async function* prepend(first: string, rest: AsyncGenerator<string>): AsyncGenerator<string> {
  yield first
  yield* rest
}
