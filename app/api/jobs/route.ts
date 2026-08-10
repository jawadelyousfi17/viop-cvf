import { after } from 'next/server'
import { dbConfigured } from '@/lib/db'
import { requireIdentity } from '@/lib/owner'
import { allowance, atLimit } from '@/lib/quota'
import { openJobs, runJob, startJob, type JobKind } from '@/lib/jobs'

export const runtime = 'nodejs'
export const maxDuration = 300

const KINDS: JobKind[] = ['map', 'expand', 'math', 'lesson']

/**
 * Starting work, and finding out what is still running.
 *
 * POST writes the row, answers with its id, and only then does the work —
 * `after` runs the callback once the response has gone out, so the model call
 * is no longer attached to the connection that asked for it. Close the tab and
 * it finishes anyway; reload and GET tells you what was going on.
 */
export async function POST(request: Request) {
  if (!dbConfigured()) return Response.json({ error: 'No database configured.' }, { status: 501 })

  const identity = await requireIdentity()
  if (!identity) return Response.json({ error: 'Sign in first.' }, { status: 401 })

  let body: { kind?: unknown; input?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const kind = KINDS.find((known) => known === body.kind)
  if (!kind) return Response.json({ error: 'Unknown kind of work.' }, { status: 400 })

  // Expanding a map or working a problem is not making a new one, so only
  // these two are counted against the plan.
  const counts = kind === 'map' ? 'mindmaps' : kind === 'lesson' ? 'lessons' : null
  if (counts) {
    const room = await allowance(identity, counts)
    if (!room.ok) {
      return Response.json(
        { error: atLimit(counts, room.limit), limit: room.limit, used: room.used },
        { status: 402 }
      )
    }
  }

  const input = (body.input ?? {}) as Record<string, unknown>
  const job = await startJob(identity, kind, input)

  after(async () => {
    await runJob(job.id, kind, input)
  })

  return Response.json({ id: job.id, kind, status: 'running' })
}

/**
 * What is happening right now, and nothing else.
 *
 * History used to be answered here too, read back out of finished job rows.
 * It is /api/solutions now: a worked solution is filed in its own table like a
 * lesson or a map, and a queue asked what it remembers is the wrong place to
 * keep anything.
 */
export async function GET() {
  if (!dbConfigured()) return Response.json({ jobs: [] })

  const identity = await requireIdentity()
  if (!identity) return Response.json({ jobs: [] }, { status: 401 })

  return Response.json({ jobs: await openJobs(identity) })
}
