import { dbConfigured } from '@/lib/db'
import { requireIdentity } from '@/lib/owner'
import { readJob } from '@/lib/jobs'

export const runtime = 'nodejs'

/**
 * One job, polled until it is done.
 *
 * Filtered by owner like everything else here, so a job id is not a way to
 * read someone else's work.
 */
export async function GET(_request: Request, ctx: RouteContext<'/api/jobs/[id]'>) {
  if (!dbConfigured()) return Response.json({ error: 'No database configured.' }, { status: 501 })

  const identity = await requireIdentity()
  if (!identity) return Response.json({ error: 'Sign in first.' }, { status: 401 })

  const { id } = await ctx.params
  const job = await readJob(identity, id)
  if (!job) return Response.json({ error: 'No such job.' }, { status: 404 })

  return Response.json({ job })
}
