import { db, dbConfigured } from '@/lib/db'
import { claim, owned, requireIdentity } from '@/lib/owner'
import { allowance, atLimit } from '@/lib/quota'
import { sanitizeTree, treeStats, type MindNode } from '@/lib/mindmap'

export const runtime = 'nodejs'

/**
 * Saved maps: the history list, and where a new map is filed.
 *
 * A map is stored as its tree, not as a board. The board is a function of the
 * tree and of what is folded at the time — regenerating it on load is cheap and
 * always current, while a stored board would be a snapshot that goes stale the
 * moment the layout changes.
 */

/** Never send a whole tree in a list — a deep map is tens of kilobytes of it. */
const LIST_FIELDS = {
  id: true,
  title: true,
  topic: true,
  source: true,
  nodeCount: true,
  depth: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function GET() {
  if (!dbConfigured()) return Response.json({ maps: [], signedIn: false })

  try {
    const identity = await requireIdentity()
    if (!identity) return Response.json({ maps: [], signedIn: false }, { status: 401 })
    await claim(identity)

    const maps = await db.mindmap.findMany({
      where: owned(identity),
      select: LIST_FIELDS,
      orderBy: { updatedAt: 'desc' },
      take: 40,
    })

    return Response.json({ maps, signedIn: Boolean(identity.userId) })
  } catch (error) {
    console.error('[mindmaps] list failed', error)
    // History is a convenience, not the product. A database that is down must
    // not take the page with it.
    return Response.json({ maps: [], signedIn: false, error: 'History is unavailable.' })
  }
}

export async function POST(request: Request) {
  if (!dbConfigured()) return Response.json({ error: 'No database configured.' }, { status: 501 })

  let body: { title?: unknown; topic?: unknown; source?: unknown; tree?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  // The tree arrives from the browser, so it is walked, budgeted and trimmed
  // before it goes anywhere near the database.
  const tree = sanitizeTree(body.tree)
  if (!tree) return Response.json({ error: 'Nothing to save.' }, { status: 400 })

  try {
    const identity = await requireIdentity()
    if (!identity) return Response.json({ error: 'Sign in to save maps.' }, { status: 401 })
    await claim(identity)

    // Checked at the moment of writing, after the claim: maps made while
    // signed out have just become this account's and count towards its plan.
    const room = await allowance(identity, 'mindmaps')
    if (!room.ok) {
      return Response.json(
        { error: atLimit('mindmaps', room.limit), limit: room.limit, used: room.used },
        { status: 402 }
      )
    }

    const stats = treeStats(tree)
    const saved = await db.mindmap.create({
      data: {
        ownerKey: identity.ownerKey,
        userId: identity.userId,
        title: title(body.title, tree),
        topic: typeof body.topic === 'string' ? body.topic.trim().slice(0, 400) : '',
        source: body.source === 'outline' ? 'outline' : 'model',
        tree: JSON.stringify(tree),
        nodeCount: stats.nodes,
        depth: stats.depth,
      },
      select: LIST_FIELDS,
    })

    return Response.json({ map: saved })
  } catch (error) {
    console.error('[mindmaps] save failed', error)
    return Response.json({ error: 'Could not save that map.' }, { status: 502 })
  }
}

function title(given: unknown, tree: MindNode) {
  const asked = typeof given === 'string' ? given.trim() : ''
  return (asked || tree.text).slice(0, 120)
}
