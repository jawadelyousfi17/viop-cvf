import { isEngine, type Engine } from '@/lib/engines'
import { DEFAULT_PROVIDER, isProvider } from '@/lib/providers'
import { LlmError, completeStructured } from '@/lib/llm'
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
import {
  MANIM_ANSWER_JSON_SCHEMA as MANIM_SCHEMA,
  isRenderableManimScene,
  normalizeManimScene,
  type ManimScene,
} from '@/lib/manim-lesson'
import {
  ANSWER_SYSTEM_PROMPT as MANIM_PROMPT,
  answerPrompt as manimAnswerPrompt,
} from '@/lib/manim-prompt'

export const maxDuration = 120

function engineConfig(engine: Engine) {
  if (engine === 'whiteboard' || engine === 'canvas') {
    return {
      system: WHITEBOARD_PROMPT,
      prompt: whiteboardAnswerPrompt,
      schema: WHITEBOARD_SCHEMA,
      parse: (raw: unknown) => {
        const scene = raw as WhiteboardScene
        return isWhiteboardScene(scene) ? normalizeWhiteboardScene(scene, 0) : null
      },
    }
  }
  if (engine === 'manim') {
    return {
      system: MANIM_PROMPT,
      prompt: manimAnswerPrompt,
      schema: MANIM_SCHEMA,
      parse: (raw: unknown) => {
        const scene = raw as ManimScene
        return isRenderableManimScene(scene) ? normalizeManimScene(scene, 0) : null
      },
    }
  }
  return {
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
  let question: unknown
  let title: unknown
  let current: unknown
  let engine: unknown
  let provider: unknown
  try {
    ;({ question, title, current, engine, provider } = await request.json())
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
