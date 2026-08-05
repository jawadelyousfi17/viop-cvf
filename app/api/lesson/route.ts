import OpenAI from 'openai'
import { LESSON_JSON_SCHEMA } from '@/lib/lesson'
import { LessonStreamParser, type LessonEvent } from '@/lib/lesson-stream'
import { SYSTEM_PROMPT, userPrompt } from '@/lib/prompt'

export const maxDuration = 300

/**
 * Streams a lesson as newline-delimited JSON events. The model writes scenes in
 * order, so the player receives scene one within a few seconds and starts
 * drawing it while the rest of the lesson is still being written.
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'OPENAI_API_KEY is not set. Add it to .env.local and restart the dev server.' },
      { status: 501 }
    )
  }

  let topic: unknown
  let history: unknown
  try {
    ;({ topic, history } = await request.json())
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  if (typeof topic !== 'string' || !topic.trim()) {
    return Response.json({ error: 'Give me a topic to teach.' }, { status: 400 })
  }
  if (topic.length > 500) {
    return Response.json(
      { error: 'That topic is too long — keep it under 500 characters.' },
      { status: 400 }
    )
  }

  const client = new OpenAI({ apiKey })
  const model = process.env.OPENAI_MODEL ?? 'gpt-5.6-luna'

  let completion
  try {
    // Chat Completions, not Responses: gpt-5.6-luna has a reported bug where
    // structured outputs on the Responses API leak stray tokens into string
    // values. The same request through this endpoint comes back clean.
    completion = await client.chat.completions.create({
      model,
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: userPrompt(
            topic.trim(),
            Array.isArray(history)
              ? history
                  .filter((h) => h && typeof h.title === 'string')
                  .slice(-6)
                  .map((h) => ({ title: String(h.title), summary: String(h.summary ?? '') }))
              : []
          ),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'lesson', strict: true, schema: LESSON_JSON_SCHEMA },
      },
    })
  } catch (error) {
    // Auth, rate limit and billing failures surface here, before any bytes are
    // streamed, so they can still be reported with a real status code.
    console.error('[lesson] request rejected', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `Could not generate the lesson: ${message}` }, { status: 502 })
  }

  const encoder = new TextEncoder()

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: LessonEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))

      const parser = new LessonStreamParser()

      try {
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) for (const event of parser.push(delta)) send(event)

          if (chunk.usage) {
            const reasoning = chunk.usage.completion_tokens_details?.reasoning_tokens ?? 0
            console.log(
              `[lesson] ${model} · in ${chunk.usage.prompt_tokens} · out ${chunk.usage.completion_tokens}` +
                ` (${reasoning} reasoning) · total ${chunk.usage.total_tokens}`
            )
          }
        }

        if (parser.count === 0) {
          send({ type: 'error', message: 'The model returned a lesson with no scenes.' })
        } else {
          send({ type: 'done', total: parser.count })
        }
      } catch (error) {
        console.error('[lesson] stream failed', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        // Scenes already delivered stay playable; the player just stops waiting.
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
      // Stops proxies buffering the response and defeating the whole point.
      'x-accel-buffering': 'no',
    },
  })
}
