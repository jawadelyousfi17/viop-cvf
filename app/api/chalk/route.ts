import OpenAI from 'openai'
import { compileChalk } from '@/lib/chalk'
import { CHALK_SYSTEM, chalkScriptPrompt, chalkTopicPrompt } from '@/lib/chalk-prompt'
import { normalizeScene } from '@/lib/lesson'
import { parseScript } from '@/lib/script-import'
import { modelFor } from '@/lib/providers'

export const maxDuration = 300

/**
 * Asks a model for Chalk, compiles it, and reports what came back.
 *
 * A test harness rather than a player: the question this branch exists to
 * answer is whether a model can write the language at all, and how much it
 * costs when it does.
 */
export async function POST(request: Request) {
  const { topic, script } = (await request.json()) as { topic?: string; script?: string }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return Response.json({ error: 'OPENAI_API_KEY is not set.' }, { status: 501 })

  const user = script?.trim()
    ? chalkScriptPrompt(parseScript(script).map((scene) => scene.narration))
    : chalkTopicPrompt(topic?.trim() || 'how a CPU cache works')

  const client = new OpenAI({ apiKey })
  const completion = await client.chat.completions.create({
    model: modelFor('openai'),
    messages: [
      { role: 'system', content: CHALK_SYSTEM },
      { role: 'user', content: user },
    ],
  })

  const source = (completion.choices[0]?.message?.content ?? '')
    // A model asked for a bare format still sometimes fences it.
    .replace(/^```[\w]*\n?|\n?```$/g, '')
    .trim()

  const { lesson, errors } = compileChalk(source)
  const drawn = lesson.scenes.map((scene, i) => normalizeScene(structuredClone(scene), i))

  // The same lesson in the JSON the model writes today, so the two can be
  // weighed against each other rather than guessed at.
  const asJson = JSON.stringify(lesson)

  return Response.json({
    usage: completion.usage,
    errors,
    source,
    json: asJson,
    title: lesson.title,
    summary: lesson.summary,
    scenes: drawn.map((scene, i) => ({
      n: i + 1,
      words: scene.narration.split(/\s+/).filter(Boolean).length,
      shapes: scene.shapes.length,
      symbols: scene.shapes.filter((s) => s.kind === 'symbol').length,
      images: scene.shapes.filter((s) => s.kind === 'image').length,
      anchors: scene.shapes.filter((s) => s.anchor).length,
      matched: scene.shapes.filter(
        (s) => s.anchor && scene.narration.toLowerCase().includes(s.anchor.toLowerCase())
      ).length,
    })),
  })
}
