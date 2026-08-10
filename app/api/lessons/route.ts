import { db, dbConfigured } from '@/lib/db'
import { claim, owned, requireIdentity } from '@/lib/owner'
import { allowance, atLimit, spend } from '@/lib/quota'
import { isRenderableScene, normalizeScene, type Lesson } from '@/lib/lesson'

export const runtime = 'nodejs'

/**
 * Lessons that have been taught, kept so they can be watched again.
 *
 * The finished document is stored, not the topic it came from. Regenerating
 * from a topic costs another model call and returns a *different* lesson —
 * different scenes, different words — and what someone reopening their history
 * wants is the one they watched, down to the sentence they remember.
 */

/** A list never carries the scenes; one lesson is tens of kilobytes of them. */
const LIST_FIELDS = {
  id: true,
  title: true,
  topic: true,
  summary: true,
  sceneCount: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function GET() {
  if (!dbConfigured()) return Response.json({ lessons: [] })

  try {
    const identity = await requireIdentity()
    if (!identity) return Response.json({ lessons: [] }, { status: 401 })
    await claim(identity)

    const lessons = await db.lesson.findMany({
      where: owned(identity),
      select: LIST_FIELDS,
      orderBy: { updatedAt: 'desc' },
      take: 40,
    })

    return Response.json({ lessons })
  } catch (error) {
    console.error('[lessons] list failed', error)
    // History is a convenience, not the product.
    return Response.json({ lessons: [], error: 'History is unavailable.' })
  }
}

export async function POST(request: Request) {
  if (!dbConfigured()) return Response.json({ error: 'No database configured.' }, { status: 501 })

  let body: { topic?: unknown; lesson?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  // The lesson comes back from the browser, so it is put through the same
  // normalizer the player uses before it is stored.
  const lesson = clean(body.lesson)
  if (!lesson) return Response.json({ error: 'Nothing to save.' }, { status: 400 })

  try {
    const identity = await requireIdentity()
    if (!identity) return Response.json({ error: 'Sign in to save lessons.' }, { status: 401 })
    await claim(identity)

    const room = await allowance(identity, 'lessons')
    if (!room.ok) {
      return Response.json(
        { error: atLimit('lessons', room.limit), limit: room.limit, used: room.used },
        { status: 402 }
      )
    }

    const saved = await db.lesson.create({
      data: {
        ownerKey: identity.ownerKey,
        userId: identity.userId,
        title: lesson.title.slice(0, 120),
        topic: typeof body.topic === 'string' ? body.topic.trim().slice(0, 400) : '',
        summary: lesson.summary.slice(0, 600),
        scenes: JSON.stringify(lesson),
        sceneCount: lesson.scenes.length,
      },
      select: LIST_FIELDS,
    })

    // After the write, not before: a save that fails must not cost anyone
    // part of an allowance they never got to use.
    await spend(identity, 'lessons')

    return Response.json({ lesson: saved })
  } catch (error) {
    console.error('[lessons] save failed', error)
    return Response.json({ error: 'Could not save that lesson.' }, { status: 502 })
  }
}

/** A lesson document from outside, made safe to store and to replay. */
export function clean(raw: unknown): Lesson | null {
  const value = raw as { title?: unknown; summary?: unknown; scenes?: unknown }
  const scenes = (Array.isArray(value?.scenes) ? value.scenes : [])
    .slice(0, 40)
    .filter(isRenderableScene)
    .map((scene, index) => normalizeScene(scene, index))

  if (!scenes.length) return null

  return {
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : 'Lesson',
    summary: typeof value.summary === 'string' ? value.summary : '',
    scenes,
  }
}
