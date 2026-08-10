import { db, dbConfigured } from '@/lib/db'
import { owned, requireIdentity } from '@/lib/owner'
import { visible } from '@/lib/demo'
import { solutionFromModel } from '@/lib/math'

export const runtime = 'nodejs'

/**
 * One saved solution: read again, or thrown away.
 *
 * Filtered by who may see it as well as by id, so an id from someone else's
 * session finds nothing — and a missing solution and someone else's answer the
 * same way, because the difference is not the caller's business.
 */

export async function GET(_request: Request, ctx: RouteContext<'/api/solutions/[id]'>) {
  if (!dbConfigured()) return Response.json({ error: 'No database configured.' }, { status: 501 })

  const { id } = await ctx.params
  const identity = await requireIdentity()
  if (!identity) return Response.json({ error: 'Sign in first.' }, { status: 401 })

  // A demo may be read by anyone. DELETE below still asks for `owned`.
  const found = await db.solution.findFirst({ where: { id, ...visible(identity) } })
  if (!found) return Response.json({ error: 'No such solution.' }, { status: 404 })

  let stored: unknown = null
  try {
    stored = JSON.parse(found.content)
  } catch {
    return Response.json({ error: 'That solution could not be read.' }, { status: 500 })
  }

  const solution = solutionFromModel(stored)
  if (!solution) return Response.json({ error: 'That solution could not be read.' }, { status: 500 })

  return Response.json({
    solution: { id: found.id, topic: found.topic, updatedAt: found.updatedAt, document: solution },
  })
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/solutions/[id]'>) {
  if (!dbConfigured()) return Response.json({ error: 'No database configured.' }, { status: 501 })

  const { id } = await ctx.params
  const identity = await requireIdentity()
  if (!identity) return Response.json({ error: 'Sign in first.' }, { status: 401 })

  const removed = await db.solution.deleteMany({ where: { id, ...owned(identity) } })
  if (!removed.count) return Response.json({ error: 'No such solution.' }, { status: 404 })

  return Response.json({ ok: true })
}
