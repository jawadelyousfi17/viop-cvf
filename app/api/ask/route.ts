import OpenAI from 'openai'
import { ANSWER_JSON_SCHEMA, isRenderableScene, normalizeScene, type Scene } from '@/lib/lesson'
import { ANSWER_SYSTEM_PROMPT, answerPrompt } from '@/lib/prompt'

export const maxDuration = 120

/**
 * Answers a question asked mid-lesson with a single drawn scene.
 *
 * Optimised for latency rather than depth: a short system prompt, minimal
 * reasoning effort and a small scene. The student is standing there waiting,
 * so a good answer in five seconds beats a better one in twenty.
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'OPENAI_API_KEY is not set.' }, { status: 501 })
  }

  let question: unknown
  let title: unknown
  let current: unknown
  try {
    ;({ question, title, current } = await request.json())
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  if (typeof question !== 'string' || !question.trim()) {
    return Response.json({ error: 'Ask something.' }, { status: 400 })
  }
  if (question.length > 400) {
    return Response.json({ error: 'Keep the question under 400 characters.' }, { status: 400 })
  }

  const client = new OpenAI({ apiKey })
  const model = process.env.OPENAI_ASK_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-5.6-luna'

  try {
    const completion = await client.chat.completions.create({
      model,
      // The whole point of this route is speed. Deep reasoning on a two
      // sentence aside is latency the student pays for and never sees.
      // gpt-5.6-luna accepts none/low/medium/high/xhigh — not 'minimal'.
      reasoning_effort: (process.env.OPENAI_ASK_EFFORT as 'none') ?? 'none',
      messages: [
        { role: 'system', content: ANSWER_SYSTEM_PROMPT },
        {
          role: 'user',
          content: answerPrompt(question.trim(), {
            title: typeof title === 'string' ? title : '',
            current: typeof current === 'string' ? current : '',
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'answer', strict: true, schema: ANSWER_JSON_SCHEMA },
      },
    })

    const usage = completion.usage
    if (usage) {
      console.log(
        `[ask] ${completion.model} · in ${usage.prompt_tokens} · out ${usage.completion_tokens}` +
          ` (${usage.completion_tokens_details?.reasoning_tokens ?? 0} reasoning)`
      )
    }

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return Response.json({ error: 'No answer came back.' }, { status: 502 })
    }

    const raw = JSON.parse(content) as Scene
    if (!isRenderableScene(raw)) {
      return Response.json({ error: 'The answer had no narration.' }, { status: 502 })
    }

    const scene = normalizeScene(raw, 0)
    return Response.json({ scene: { ...scene, id: `answer-${scene.id}-${question.length}` } })
  } catch (error) {
    console.error('[ask] failed', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `Could not answer: ${message}` }, { status: 502 })
  }
}
