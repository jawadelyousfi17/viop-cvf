import OpenAI from 'openai'
import { FOLLOWUP_SYSTEM_PROMPT, followupPrompt } from '@/lib/prompt'
import { FAST_MODELS } from '@/lib/providers'

export const maxDuration = 60

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: { type: 'array', items: { type: 'string' } },
  },
} as const

/**
 * Suggests where to go next after a lesson. Fast and cheap by design — it runs
 * while the learner is still watching and nobody is waiting on it, so every
 * failure path returns an empty list rather than an error.
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return Response.json({ questions: [] })

  let lesson: unknown
  try {
    ;({ lesson } = await request.json())
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const parsed = lesson as { title?: string; summary?: string; scenes?: { narration: string }[] }
  if (!parsed?.title || !parsed.scenes?.length) return Response.json({ questions: [] })

  try {
    const completion = await new OpenAI({ apiKey }).chat.completions.create({
      // Also a wait: the lesson has ended and the screen is empty until these
      // land. Same fast model as the mid-lesson answer.
      model: process.env.OPENAI_ASK_MODEL ?? FAST_MODELS.openai,
      reasoning_effort: 'none',
      messages: [
        { role: 'system', content: FOLLOWUP_SYSTEM_PROMPT },
        {
          role: 'user',
          content: followupPrompt({
            title: parsed.title,
            summary: parsed.summary ?? '',
            scenes: parsed.scenes,
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'followups', strict: true, schema: SCHEMA },
      },
    })

    const content = completion.choices[0]?.message?.content
    const questions = content ? (JSON.parse(content).questions as string[]) : []
    return Response.json({ questions: questions.filter(Boolean).slice(0, 3) })
  } catch (error) {
    console.error('[followups] failed', error)
    return Response.json({ questions: [] })
  }
}
