import { DEFAULT_PROVIDER, isProvider } from '@/lib/providers'
import { LlmError, completeStructured } from '@/lib/llm'
import { requireIdentity } from '@/lib/owner'
import { MATH_JSON_SCHEMA, solutionFromModel } from '@/lib/math'
import { MATH_SYSTEM_PROMPT, mathPrompt } from '@/lib/prompt'

export const maxDuration = 120

/**
 * Works a problem the way a professor would at a board.
 *
 * Returns the working, not a board: the steps come back as text and LaTeX, and
 * lib/math.ts lays them out for the SVG engine. A route that also returned
 * coordinates would hand the client a second copy of the truth, and the layout
 * of a column of steps is not something a model should spend tokens on.
 *
 * Behind the wall, like everything else here that calls a model.
 */
export async function POST(request: Request) {
  if (!(await requireIdentity())) {
    return Response.json({ error: 'Sign in to use the tutor.' }, { status: 401 })
  }

  let question: unknown
  let provider: unknown
  let model: unknown
  try {
    ;({ question, provider, model } = await request.json())
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  if (typeof question !== 'string' || !question.trim()) {
    return Response.json({ error: 'Give it a problem to work.' }, { status: 400 })
  }
  if (question.length > 2000) {
    return Response.json({ error: 'Keep the problem under 2000 characters.' }, { status: 400 })
  }

  try {
    const content = await completeStructured({
      provider: isProvider(provider) ? provider : DEFAULT_PROVIDER,
      model: typeof model === 'string' ? model : undefined,
      system: MATH_SYSTEM_PROMPT,
      user: mathPrompt(question),
      // Mathematics is the one place here where thinking earns its keep: a
      // wrong line is worse than a slow one.
      effort: process.env.OPENAI_MATH_EFFORT ?? 'medium',
      schema: MATH_JSON_SCHEMA,
      maxTokens: 8_000,
    })

    if (!content) return Response.json({ error: 'No working came back.' }, { status: 502 })

    const solution = solutionFromModel(JSON.parse(content))
    if (!solution) return Response.json({ error: 'That came back empty.' }, { status: 502 })

    return Response.json({ solution })
  } catch (error) {
    if (error instanceof LlmError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    console.error('[math] failed', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `Could not work that: ${message}` }, { status: 502 })
  }
}
