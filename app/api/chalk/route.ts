import OpenAI from 'openai'
import { compileChalk } from '@/lib/chalk'
import { ChalkStreamParser } from '@/lib/chalk-stream'
import { CHALK_SYSTEM, chalkScriptPrompt, chalkTopicPrompt } from '@/lib/chalk-prompt'
import { parseScript } from '@/lib/script-import'
import { modelFor } from '@/lib/providers'

export const maxDuration = 300

/**
 * Streams a Chalk lesson as newline-delimited JSON, scene by scene.
 *
 * The board can start drawing scene one while the model is still writing scene
 * four — which is the whole reason the older engines stream, and the one place
 * Chalk was behind them.
 */
export async function POST(request: Request) {
  const { topic, script } = (await request.json()) as { topic?: string; script?: string }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return Response.json({ error: 'OPENAI_API_KEY is not set.' }, { status: 501 })

  // In script mode the narration is already written. It is handed to the
  // compiler rather than asked back from the model.
  const blocks = script?.trim() ? parseScript(script).map((scene) => scene.narration) : []
  const user = blocks.length ? chalkScriptPrompt(blocks) : chalkTopicPrompt(topic?.trim() || 'how a CPU cache works')

  const client = new OpenAI({ apiKey })
  const completion = await client.chat.completions.create({
    model: modelFor('openai'),
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      { role: 'system', content: CHALK_SYSTEM },
      { role: 'user', content: user },
    ],
  })

  const encoder = new TextEncoder()
  const parser = new ChalkStreamParser({ narration: blocks })

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))

      let source = ''
      let usage: unknown = null

      try {
        for await (const part of completion) {
          if (part.usage) usage = part.usage
          const text = part.choices[0]?.delta?.content
          if (!text) continue
          source += text
          for (const event of parser.push(text)) send(event)
        }

        for (const event of parser.end()) send(event)
        // Useful while this is still a prototype: what it cost, and anything
        // the compiler could not make sense of.
        send({ type: 'stats', usage, errors: parser.errors, source })
      } catch (error) {
        send({
          type: 'error',
          message: error instanceof Error ? error.message : 'Something went wrong.',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(body, {
    headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' },
  })
}

/** Compiles Chalk that is already written. Handy for testing the language. */
export async function PUT(request: Request) {
  const { source, narration } = (await request.json()) as {
    source: string
    narration?: string[]
  }
  const { lesson, errors } = compileChalk(source, { narration })
  return Response.json({ errors, lesson })
}
