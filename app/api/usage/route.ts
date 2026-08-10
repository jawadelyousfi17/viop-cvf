import { requireIdentity } from '@/lib/owner'
import { allowance, type Countable } from '@/lib/quota'
import { dbConfigured } from '@/lib/db'
import { planFor } from '@/lib/subscription'

export const runtime = 'nodejs'

/**
 * How much of the plan is left, per thing.
 *
 * The workspace needs this before anyone presses anything. Finding out you
 * have run out by asking for a lesson and being refused is a wasted minute of
 * waiting and a worse way to be told; with this the box can say so up front
 * and stop taking input it knows will be turned down.
 *
 * Maps and lessons are counted separately and have separate limits, so this
 * answers for both rather than for "the plan" — running out of lessons has
 * nothing to say about maps.
 */

const KINDS: Countable[] = ['mindmaps', 'lessons']

export interface UsageView {
  /** Per kind: how many have been made, and how many may be. */
  mindmaps: { used: number; limit: number | null; ok: boolean }
  lessons: { used: number; limit: number | null; ok: boolean }
  /**
   * Whether this account generates anyway while generation is paused.
   *
   * The pause is a switch in the client bundle, which makes it a statement
   * about the deployment rather than about who is asking — and the people
   * building the thing still have to be able to use it. So the server, which
   * is the only side that knows who is signed in, answers that here.
   *
   * Keyed on the plan rather than on a second list of names: the accounts that
   * are exempt are exactly the ones not on the free plan, and there is already
   * one place that decides that.
   */
  unpaused: boolean
}

export async function GET() {
  // No database is not "no allowance" — nothing is being counted at all, so
  // nothing should be held back.
  if (!dbConfigured()) return Response.json(open())

  const identity = await requireIdentity()
  if (!identity) return Response.json({ error: 'Sign in first.' }, { status: 401 })

  const entries = await Promise.all(
    KINDS.map(async (kind) => {
      const room = await allowance(identity, kind)
      return [
        kind,
        {
          used: room.used,
          // Infinity does not survive JSON — it becomes null, and every reader
          // has to know that. Say null on purpose instead: "no ceiling".
          limit: Number.isFinite(room.limit) ? room.limit : null,
          ok: room.ok,
        },
      ] as const
    })
  )

  return Response.json(
    {
      ...(Object.fromEntries(entries) as unknown as UsageView),
      unpaused: (await planFor(identity.userId)) !== 'free',
    } satisfies UsageView,
    { headers: { 'cache-control': 'no-store' } }
  )
}

// No database is not an exemption: the credits are out for everyone, and a
// deployment without a database has no way to say who anybody is.
const open = (): UsageView => ({
  mindmaps: { used: 0, limit: null, ok: true },
  lessons: { used: 0, limit: null, ok: true },
  unpaused: false,
})
