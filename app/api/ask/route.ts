import { DEFAULT_PROVIDER, isProvider } from '@/lib/providers'
import { LlmError, completeStructured } from '@/lib/llm'
import {
  ANSWER_JSON_SCHEMA,
  isRenderableScene,
  normalizeScene,
  type Scene,
} from '@/lib/lesson'
import { ANSWER_SYSTEM_PROMPT, answerPrompt } from '@/lib/prompt'

export const maxDuration = 120

const config = {
  system: ANSWER_SYSTEM_PROMPT,
  prompt: answerPrompt,
  schema: ANSWER_JSON_SCHEMA,
  parse: (raw: unknown) => {
    const scene = raw as Scene
    return isRenderableScene(scene) ? normalizeScene(scene, 0) : null
  },
}

/**
 * Answers a question asked mid-lesson with a single scene, in whichever
 * engine's language the lesson is being rendered in. Optimised for latency:
 * short prompt, no reasoning — the student is standing there waiting.
 */
export async function POST(request: Request) {
  let question: unknown
  let title: unknown
  let current: unknown
  let provider: unknown
  try {
    ;({ question, title, current, provider } = await request.json())
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  if (typeof question !== 'string' || !question.trim()) {
    return Response.json({ error: 'Ask something.' }, { status: 400 })
  }
  if (question.length > 400) {
    return Response.json({ error: 'Keep the question under 400 characters.' }, { status: 400 })
  }

  try {
    const content = await completeStructured({
      provider: isProvider(provider) ? provider : DEFAULT_PROVIDER,
      system: config.system,
      user: config.prompt(question.trim(), {
        title: typeof title === 'string' ? title : '',
        current: typeof current === 'string' ? current : '',
      }),
      schema: config.schema,
      // The student is standing there waiting, so no reasoning budget.
      // gpt-5.6-luna accepts none/low/medium/high/xhigh — not 'minimal'.
      effort: process.env.OPENAI_ASK_EFFORT ?? 'none',
      maxTokens: 8_000,
    })

    if (!content) {
      return Response.json({ error: 'No answer came back.' }, { status: 502 })
    }

    const scene = config.parse(JSON.parse(content))
    if (!scene) {
      return Response.json({ error: 'The answer had no narration.' }, { status: 502 })
    }

    return Response.json({ scene: { ...scene, id: `answer-${scene.id}-${question.length}` } })
  } catch (error) {
    if (error instanceof LlmError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    console.error('[ask] failed', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `Could not answer: ${message}` }, { status: 502 })
  }
}
