import { isEngine, type Engine } from '@/lib/engines'
import { parseScript } from '@/lib/script-import'
import { DEFAULT_PROVIDER, isProvider } from '@/lib/providers'
import { LlmError, streamStructured } from '@/lib/llm'
import { LESSON_JSON_SCHEMA as WHITEBOARD_SCHEMA } from '@/lib/lesson'
import { LessonStreamParser as WhiteboardParser } from '@/lib/lesson-stream'
import {
  SYSTEM_PROMPT as WHITEBOARD_PROMPT,
  scriptPrompt as whiteboardScript,
  userPrompt as whiteboardUser,
} from '@/lib/prompt'
import { LESSON_JSON_SCHEMA as SLIDES_SCHEMA } from '@/lib/template-lesson'
import { LessonStreamParser as SlidesParser } from '@/lib/template-stream'
import { SYSTEM_PROMPT as SLIDES_PROMPT, userPrompt as slidesUser } from '@/lib/template-prompt'
import { IT_LESSON_JSON_SCHEMA as IT_SCHEMA } from '@/lib/it-lesson'
import { ITStreamParser } from '@/lib/it-stream'
import { SYSTEM_PROMPT as IT_PROMPT, userPrompt as itUser } from '@/lib/it-prompt'
import { MANIM_LESSON_JSON_SCHEMA as MANIM_SCHEMA } from '@/lib/manim-lesson'
import { ManimStreamParser } from '@/lib/manim-stream'
import { SYSTEM_PROMPT as MANIM_PROMPT, userPrompt as manimUser } from '@/lib/manim-prompt'

export const maxDuration = 300

/** Everything that differs between the engines, in one place. */
function engineConfig(engine: Engine) {
  // The whiteboard and canvas engines share a board language, so they share a
  // prompt and a schema; only the renderer differs.
  if (engine === 'whiteboard' || engine === 'canvas') {
    return {
      system: WHITEBOARD_PROMPT,
      user: whiteboardUser,
      // Only the board engines can be given a finished script: the others
      // write their own narration as part of planning a slide or an animation.
      script: whiteboardScript,
      schema: WHITEBOARD_SCHEMA,
      parser: () => new WhiteboardParser(),
    }
  }
  if (engine === 'it') {
    return {
      system: IT_PROMPT,
      user: itUser,
      schema: IT_SCHEMA,
      parser: () => new ITStreamParser(),
    }
  }
  if (engine === 'manim') {
    return {
      system: MANIM_PROMPT,
      user: manimUser,
      schema: MANIM_SCHEMA,
      parser: () => new ManimStreamParser(),
    }
  }
  return {
    system: SLIDES_PROMPT,
    user: slidesUser,
    schema: SLIDES_SCHEMA,
    parser: () => new SlidesParser(),
  }
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
  let engine: unknown
  let provider: unknown
  let model: unknown
  try {
    ;({ topic, script, history, engine, provider, model } = await request.json())
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

  const config = engineConfig(isEngine(engine) ? engine : 'slides')

  const past = Array.isArray(history)
    ? history
        .filter((h) => h && typeof h.title === 'string')
        .slice(-6)
        .map((h) => ({ title: String(h.title), summary: String(h.summary ?? '') }))
    : []

  let userPrompt: string
  if (hasScript && config.script) {
    const blocks = parseScript(script as string).map((scene) => scene.narration)
    if (!blocks.length) {
      return Response.json(
        { error: 'No narration found in that script. Separate scenes with blank lines.' },
        { status: 400 }
      )
    }
    userPrompt = config.script(blocks, past)
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

/** Puts an already-pulled chunk back at the front of a stream. */
async function* prepend(first: string, rest: AsyncGenerator<string>): AsyncGenerator<string> {
  yield first
  yield* rest
}
