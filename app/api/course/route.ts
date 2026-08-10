import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { LlmError, streamText } from '@/lib/llm'
import { DEFAULT_PROVIDER, isProvider } from '@/lib/providers'
import { parseCourse, type Course } from '@/lib/course'
import { cacheKey, hasSpeech } from '@/lib/tts-cache'
import { speechIdentity } from '@/lib/tts-identity'
import { DEFAULT_VOICE_ID } from '@/lib/voices'

export const maxDuration = 120

const DIRECTORY = 'courses'

/**
 * A slug is a name, never a path.
 *
 * Matched against a whitelist pattern rather than sanitised, because sanitising
 * a path is a game you lose eventually — `..%2f`, a null byte, a symlink. A
 * name that is only letters, digits and dashes cannot address anything outside
 * the directory no matter how it is decoded.
 */
const SLUG = /^[a-z0-9][a-z0-9-]{0,60}$/

/**
 * The lesson, parsed, plus which steps already have a recording.
 *
 * That last part is the point of the route rather than an extra. Synthesis is
 * the one thing here that costs real money, so the player is told up front
 * exactly which steps are free to play and which will spend credit — and can
 * say so before the learner presses anything.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const slug = url.searchParams.get('slug')

  if (!slug) return Response.json({ courses: await list() })

  if (!SLUG.test(slug)) {
    return Response.json({ error: 'Not a course name.' }, { status: 400 })
  }

  let source: string
  try {
    source = await readFile(join(process.cwd(), DIRECTORY, `${slug}.md`), 'utf8')
  } catch {
    return Response.json({ error: `No course called “${slug}”.` }, { status: 404 })
  }

  const course = parseCourse(source, slug)

  return Response.json(
    { ...course, voiced: await voiced(course, url.searchParams.get('voice')) },
    { headers: { 'cache-control': 'no-store' } }
  )
}

/**
 * Which steps are already recorded, in step order.
 *
 * The answer is only meaningful if it is keyed exactly as `/api/tts` keys what
 * it writes — same voice, same trim, same cap. A near-miss here is worse than
 * no answer at all: it reports a lesson as unrecorded, and whoever believes it
 * pays to synthesise audio that was already sitting on disk. Hence the default
 * voice rather than `null`, which resolves to a voice the player never uses.
 */
const MAX_INPUT = 4000

async function voiced(course: Course, voiceId: string | null) {
  const { provider, voice, model } = speechIdentity(voiceId ?? DEFAULT_VOICE_ID)
  return Promise.all(
    course.steps.map((step) =>
      step.narration
        ? hasSpeech(
            cacheKey({ text: step.narration.trim().slice(0, MAX_INPUT), provider, voice, model })
          )
        : Promise.resolve(true)
    )
  )
}

async function list() {
  try {
    const files = await readdir(join(process.cwd(), DIRECTORY))
    const found = await Promise.all(
      files
        .filter((file) => file.endsWith('.md'))
        .map(async (file) => {
          const slug = file.replace(/\.md$/, '')
          if (!SLUG.test(slug)) return null
          const source = await readFile(join(process.cwd(), DIRECTORY, file), 'utf8')
          const course = parseCourse(source, slug)
          return {
            slug,
            title: course.title || slug,
            takeaway: course.takeaway,
            steps: course.steps.length,
          }
        })
    )
    return found.filter(Boolean)
  } catch {
    return []
  }
}

/**
 * The learner's own question, answered against the step they are on.
 *
 * Text only, and deliberately not spoken. Voice credit is the scarce resource
 * here and the lesson's own narration has first claim on it — an answer that
 * arrives as text costs nothing and can be read at the reader's pace, which is
 * usually what someone who has stopped to ask a question wants anyway.
 */
export async function POST(request: Request) {
  let body: { question?: unknown; step?: unknown; code?: unknown; provider?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 500) : ''
  if (!question) return Response.json({ error: 'Ask something.' }, { status: 400 })

  const context = typeof body.step === 'string' ? body.step.slice(0, 2000) : ''
  const code = typeof body.code === 'string' ? body.code.slice(0, 2000) : ''
  const provider = isProvider(body.provider) ? body.provider : DEFAULT_PROVIDER

  const system =
    'You are a patient programming teacher answering a beginner mid-lesson. ' +
    'Answer in at most four sentences, in plain prose — no headings, no bullet lists, ' +
    'no preamble. You may include one very short inline code example in backticks. ' +
    'Answer only what was asked; if the question is not about the lesson, say so briefly ' +
    'and bring them back to it. Never invent behaviour a language does not have.'

  const user = [
    `The learner is on this part of a JavaScript fundamentals lesson:\n${context}`,
    code.trim() ? `The code currently in their editor:\n${code}` : '',
    `Their question: ${question}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of streamText({ provider, system, user, maxTokens: 400 })) {
            controller.enqueue(encoder.encode(chunk))
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Something went wrong.'
          controller.enqueue(encoder.encode(`\n\n(${message})`))
        }
        controller.close()
      },
    })

    return new Response(stream, {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  } catch (error) {
    if (error instanceof LlmError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    return Response.json({ error: 'Could not answer that.' }, { status: 502 })
  }
}
