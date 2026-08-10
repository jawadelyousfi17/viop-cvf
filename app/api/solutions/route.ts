import { db, dbConfigured } from '@/lib/db'
import { claim, requireIdentity } from '@/lib/owner'
import { isDemo, visible } from '@/lib/demo'
import { solutionFromModel } from '@/lib/math'

export const runtime = 'nodejs'

/**
 * Worked solutions, kept so they can be read again.
 *
 * The same shape as lessons and maps, and for the same reason. A solution used
 * to live only as a finished `math` row in the job queue, which is a receipt
 * for some work rather than the work: the live feed drops a job a minute after
 * it lands, so the rail listed nothing and said worked solutions were not kept
 * when in fact they were kept and never shown.
 *
 * The finished document is stored rather than the question. Solving it again
 * costs another model call and produces different working; what someone
 * reopening their history wants is the one they read.
 */

/** A list never carries the working; one solution is fourteen steps of it. */
const LIST_FIELDS = {
  id: true,
  title: true,
  topic: true,
  stepCount: true,
  createdAt: true,
  updatedAt: true,
} as const

export interface SavedSolution {
  id: string
  title: string
  topic: string
  stepCount: number
  updatedAt: string
  demo?: boolean
}

export async function GET() {
  if (!dbConfigured()) return Response.json({ solutions: [] })

  try {
    const identity = await requireIdentity()
    if (!identity) return Response.json({ solutions: [] }, { status: 401 })
    await claim(identity)

    // Yours, plus the demo account's — see lib/demo.ts. Reading only.
    const rows = await db.solution.findMany({
      where: visible(identity),
      select: { ...LIST_FIELDS, userId: true },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    })

    const solutions = rows.map(({ userId, ...solution }) => ({
      ...solution,
      demo: isDemo({ userId }, identity),
    }))

    return Response.json({ solutions })
  } catch (error) {
    console.error('[solutions] list failed', error)
    // History is a convenience, not the product.
    return Response.json({ solutions: [], error: 'History is unavailable.' })
  }
}

export async function POST(request: Request) {
  if (!dbConfigured()) return Response.json({ error: 'No database configured.' }, { status: 501 })

  let body: { solution?: unknown; topic?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  // It comes back from the browser, so it goes through the same normalizer the
  // board draws from before it is stored.
  const solution = solutionFromModel(body.solution)
  if (!solution?.steps.length) return Response.json({ error: 'Nothing to save.' }, { status: 400 })

  try {
    const identity = await requireIdentity()
    if (!identity) return Response.json({ error: 'Sign in to save solutions.' }, { status: 401 })
    await claim(identity)

    // Not counted against the plan. Working a problem is already charged as a
    // job when it is asked for, and charging the same act twice would mean the
    // allowance ran out faster for anyone whose history actually saved.
    const saved = await db.solution.create({
      data: {
        ownerKey: identity.ownerKey,
        userId: identity.userId,
        title: (solution.title || 'A problem').slice(0, 120),
        topic: typeof body.topic === 'string' ? body.topic.trim().slice(0, 400) : '',
        content: JSON.stringify(solution),
        stepCount: solution.steps.length,
      },
      select: LIST_FIELDS,
    })

    return Response.json({ solution: saved })
  } catch (error) {
    console.error('[solutions] save failed', error)
    return Response.json({ error: 'Could not save that solution.' }, { status: 502 })
  }
}
