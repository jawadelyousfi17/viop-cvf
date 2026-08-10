import { db, dbConfigured } from '@/lib/db'
import { owned, requireIdentity } from '@/lib/owner'
import { visible } from '@/lib/demo'
import { sanitizeTree, treeStats } from '@/lib/mindmap'

export const runtime = 'nodejs'

/**
 * One saved map: read it back, keep it up to date as it grows, or throw it away.
 *
 * Every query is filtered by owner as well as by id, so an id guessed or kept
 * from another session finds nothing rather than someone else's map. That is
 * also why a missing row and a row belonging to someone else return the same
 * 404 — the difference is not the caller's business.
 */

export async function GET(_request: Request, ctx: RouteContext<'/api/mindmaps/[id]'>) {
  if (!dbConfigured()) return Response.json({ error: 'No database configured.' }, { status: 501 })

  const { id } = await ctx.params
  const identity = await requireIdentity()
  if (!identity) return Response.json({ error: 'Sign in first.' }, { status: 401 })

  // A demo may be opened by anyone. PATCH and DELETE below still ask for
  // `owned`, so it can be read and never written.
  const found = await db.mindmap.findFirst({ where: { id, ...visible(identity) } })
  if (!found) return Response.json({ error: 'No such map.' }, { status: 404 })

  const tree = sanitizeTree(safeParse(found.tree))
  if (!tree) return Response.json({ error: 'That map could not be read.' }, { status: 500 })

  return Response.json({
    map: {
      id: found.id,
      title: found.title,
      topic: found.topic,
      source: found.source,
      updatedAt: found.updatedAt,
      mindmap: { heading: found.title, root: tree },
    },
  })
}

export async function PATCH(request: Request, ctx: RouteContext<'/api/mindmaps/[id]'>) {
  if (!dbConfigured()) return Response.json({ error: 'No database configured.' }, { status: 501 })

  const { id } = await ctx.params

  let body: { tree?: unknown; title?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const tree = sanitizeTree(body.tree)
  if (!tree) return Response.json({ error: 'Nothing to save.' }, { status: 400 })

  const identity = await requireIdentity()
  if (!identity) return Response.json({ error: 'Sign in first.' }, { status: 401 })

  const stats = treeStats(tree)

  // updateMany rather than update: it takes a filter, so ownership is part of
  // the write itself instead of a read-then-write with a gap in the middle.
  const written = await db.mindmap.updateMany({
    where: { id, ...owned(identity) },
    data: {
      tree: JSON.stringify(tree),
      nodeCount: stats.nodes,
      depth: stats.depth,
      ...(typeof body.title === 'string' && body.title.trim()
        ? { title: body.title.trim().slice(0, 120) }
        : {}),
    },
  })

  if (!written.count) return Response.json({ error: 'No such map.' }, { status: 404 })
  return Response.json({ ok: true, nodeCount: stats.nodes, depth: stats.depth })
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/mindmaps/[id]'>) {
  if (!dbConfigured()) return Response.json({ error: 'No database configured.' }, { status: 501 })

  const { id } = await ctx.params
  const identity = await requireIdentity()
  if (!identity) return Response.json({ error: 'Sign in first.' }, { status: 401 })

  const removed = await db.mindmap.deleteMany({ where: { id, ...owned(identity) } })
  if (!removed.count) return Response.json({ error: 'No such map.' }, { status: 404 })

  return Response.json({ ok: true })
}

function safeParse(json: string) {
  try {
    return JSON.parse(json) as unknown
  } catch {
    return null
  }
}
