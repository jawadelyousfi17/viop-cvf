import { db, dbConfigured } from '@/lib/db'
import { owned, requireIdentity } from '@/lib/owner'
import { visible } from '@/lib/demo'
import { clean } from '../route'

export const runtime = 'nodejs'

/**
 * One saved lesson: played again, or thrown away.
 *
 * Filtered by owner as well as by id, so an id from someone else's session
 * finds nothing — and a missing lesson and someone else's lesson answer the
 * same way, because the difference is not the caller's business.
 */

export async function GET(_request: Request, ctx: RouteContext<'/api/lessons/[id]'>) {
  if (!dbConfigured()) return Response.json({ error: 'No database configured.' }, { status: 501 })

  const { id } = await ctx.params
  const identity = await requireIdentity()
  if (!identity) return Response.json({ error: 'Sign in first.' }, { status: 401 })

  // A demo may be watched by anyone. DELETE below still asks for `owned`.
  const found = await db.lesson.findFirst({ where: { id, ...visible(identity) } })
  if (!found) return Response.json({ error: 'No such lesson.' }, { status: 404 })

  let stored: unknown = null
  try {
    stored = JSON.parse(found.scenes)
  } catch {
    return Response.json({ error: 'That lesson could not be read.' }, { status: 500 })
  }

  const lesson = clean(stored)
  if (!lesson) return Response.json({ error: 'That lesson could not be read.' }, { status: 500 })

  return Response.json({
    lesson: { id: found.id, topic: found.topic, updatedAt: found.updatedAt, document: lesson },
  })
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/lessons/[id]'>) {
  if (!dbConfigured()) return Response.json({ error: 'No database configured.' }, { status: 501 })

  const { id } = await ctx.params
  const identity = await requireIdentity()
  if (!identity) return Response.json({ error: 'Sign in first.' }, { status: 401 })

  const removed = await db.lesson.deleteMany({ where: { id, ...owned(identity) } })
  if (!removed.count) return Response.json({ error: 'No such lesson.' }, { status: 404 })

  return Response.json({ ok: true })
}
