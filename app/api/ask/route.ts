import OpenAI from 'openai'
import { isEngine, type Engine } from '@/lib/engines'
import {
  ANSWER_JSON_SCHEMA as WHITEBOARD_SCHEMA,
  isRenderableScene as isWhiteboardScene,
  normalizeScene as normalizeWhiteboardScene,
  type Scene as WhiteboardScene,
} from '@/lib/lesson'
import {
  ANSWER_SYSTEM_PROMPT as WHITEBOARD_PROMPT,
  answerPrompt as whiteboardAnswerPrompt,
} from '@/lib/prompt'
import {
  SCENE_JSON_SCHEMA as SLIDES_SCHEMA,
  isRenderableScene as isSlidesScene,
  normalizeScene as normalizeSlidesScene,
  type TemplateScene,
} from '@/lib/template-lesson'
import {
  ANSWER_SYSTEM_PROMPT as SLIDES_PROMPT,
  answerPrompt as slidesAnswerPrompt,
} from '@/lib/template-prompt'

export const maxDuration = 120

function engineConfig(engine: Engine) {
  return engine === 'whiteboard' || engine === 'canvas'
    ? {
        system: WHITEBOARD_PROMPT,
        prompt: whiteboardAnswerPrompt,
        schema: WHITEBOARD_SCHEMA,
        parse: (raw: unknown) => {
          const scene = raw as WhiteboardScene
          return isWhiteboardScene(scene) ? normalizeWhiteboardScene(scene, 0) : null
        },
      }
    : {
        system: SLIDES_PROMPT,
        prompt: slidesAnswerPrompt,
        schema: SLIDES_SCHEMA,
        parse: (raw: unknown) => {
          const scene = raw as TemplateScene
          return isSlidesScene(scene) ? normalizeSlidesScene(scene, 0) : null
        },
      }
}

/**
 * Answers a question asked mid-lesson with a single scene, in whichever
 * engine's language the lesson is being rendered in. Optimised for latency:
 * short prompt, no reasoning — the student is standing there waiting.
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'OPENAI_API_KEY is not set.' }, { status: 501 })
  }

  let question: unknown
  let title: unknown
  let current: unknown
  let engine: unknown
  try {
    ;({ question, title, current, engine } = await request.json())
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  if (typeof question !== 'string' || !question.trim()) {
    return Response.json({ error: 'Ask something.' }, { status: 400 })
  }
  if (question.length > 400) {
    return Response.json({ error: 'Keep the question under 400 characters.' }, { status: 400 })
  }

  const config = engineConfig(isEngine(engine) ? engine : 'slides')
  const client = new OpenAI({ apiKey })
  const model = process.env.OPENAI_ASK_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-5.6-luna'

  try {
    const completion = await client.chat.completions.create({
      model,
      // gpt-5.6-luna accepts none/low/medium/high/xhigh — not 'minimal'.
      reasoning_effort: (process.env.OPENAI_ASK_EFFORT as 'none') ?? 'none',
      messages: [
        { role: 'system', content: config.system },
        {
          role: 'user',
          content: config.prompt(question.trim(), {
            title: typeof title === 'string' ? title : '',
            current: typeof current === 'string' ? current : '',
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'answer', strict: true, schema: config.schema },
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

    const scene = config.parse(JSON.parse(content))
    if (!scene) {
      return Response.json({ error: 'The answer had no narration.' }, { status: 502 })
    }

    return Response.json({ scene: { ...scene, id: `answer-${scene.id}-${question.length}` } })
  } catch (error) {
    console.error('[ask] failed', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `Could not answer: ${message}` }, { status: 502 })
  }
}
