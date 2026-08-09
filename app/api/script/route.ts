import { LlmError, streamText } from '@/lib/llm'

export const maxDuration = 300

/**
 * Writes the narration script for a topic — and nothing else.
 *
 * Generation is split in two on purpose: gpt-5.6-terra writes the words,
 * gpt-5.6-luna draws the board for them. The writer never thinks about
 * boxes and the illustrator never rewrites the prose.
 */
const SYSTEM = `You write narration scripts for a spoken whiteboard lesson.

Rules:
- Write 6 to 10 sections, separated by exactly one blank line.
- Each section is 2 to 4 spoken sentences — the words a teacher would actually say, out loud, to one student.
- Plain prose only: no headings, no lists, no markdown, no stage directions.
- One idea per section. Concrete and vivid; simple words; explain like the listener has never met the topic.
- Open by hooking the question the topic raises; end with the one-sentence takeaway.`

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
        .map((h) => `- ${h.title}`)
        .join('\n')
    : ''

  const user =
    `Write the narration script for a lesson on: ${topic.trim()}` +
    (past ? `\n\nThe student has already had lessons on:\n${past}\nDo not repeat them.` : '')

  try {
    let text = ''
    for await (const delta of streamText({
      provider: 'openai',
      model: 'gpt-5.6-terra',
      system: SYSTEM,
      user,
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
