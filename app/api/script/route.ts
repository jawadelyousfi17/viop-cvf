import { LlmError, streamText } from '@/lib/llm'

export const maxDuration = 300

/**
 * Writes the narration for a topic — and nothing else.
 *
 * Deliberately under-instructed: terra answers the way a good chatbot
 * answers, and that natural, paragraph-at-a-time explanation IS the script.
 * The paragraphs become the scenes; luna draws a board for each one.
 */
const SYSTEM =
  'Explain the topic you are given, out loud, as if teaching one person. ' +
  'Plain text only — no markdown, no headings, no lists. Short paragraphs. ' +
  'Keep the whole thing under 400 words.'

export async function POST(request: Request) {
  let topic: unknown
  let history: unknown
  try {
    ;({ topic, history } = await request.json())
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }
  if (typeof topic !== 'string' || !topic.trim()) {
    return Response.json({ error: 'Give me a topic to write about.' }, { status: 400 })
  }
  if (topic.length > 500) {
    return Response.json({ error: 'Keep the topic under 500 characters.' }, { status: 400 })
  }

  const past = Array.isArray(history)
    ? history
        .filter((h) => h && typeof h.title === 'string')
        .slice(-6)
        .map((h) => h.title)
        .join(', ')
    : ''

  // The topic goes through as the user typed it — the model is a chatbot
  // being asked a question, not a copywriter being briefed.
  const user = topic.trim() + (past ? `\n\n(Already covered earlier: ${past}.)` : '')

  try {
    let text = ''
    for await (const delta of streamText({
      provider: 'openai',
      model: 'gpt-5.6-terra',
      system: SYSTEM,
      user,
      maxTokens: 1_500,
    })) {
      text += delta
    }
    const script = text.trim()
    if (!script) return Response.json({ error: 'No script came back.' }, { status: 502 })
    return Response.json({ script })
  } catch (error) {
    if (error instanceof LlmError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    console.error('[script] failed', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `Could not write the script: ${message}` }, { status: 502 })
  }
}
