import 'server-only'

import { cache } from 'react'
import { db } from './db'
import { PLAN_LIMITS, type PlanId, type PlanLimits } from './plans'
import { currentUser } from './supabase/server'
import type { Subscription } from './generated/prisma/client'

/**
 * The one place that answers "what is this account paying for?".
 *
 * Every check is a positive grant: no row, an unrecognised plan or an expired
 * one all come out as free. A missed webhook can therefore cost someone their
 * plan for a moment, which is the right way round — the other way it hands out
 * the product forever.
 */

/** This user's subscription row. Memoised per render pass, so several guards
 *  in one request cost one query. */
export const getSubscription = cache(
  async (userId: string): Promise<Subscription | null> =>
    db.subscription.findUnique({ where: { userId } })
)

/**
 * The plan actually in force, which is not always the one in the row.
 *
 * A period end in the past means free whatever the status says: a webhook that
 * never arrived, or a card that stopped working, must not leave a paid plan
 * running forever. A cancellation keeps its plan until that date — they paid
 * for the month — and drops to free when there is no date to wait for.
 */
export function effectivePlan(sub: Subscription | null): PlanId {
  if (!sub) return 'free'
  if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() <= Date.now()) return 'free'
  if (sub.status === 'canceled' && !sub.currentPeriodEnd) return 'free'
  return sub.plan
}

/**
 * Accounts on the paid plan without a paid row behind them.
 *
 * The people building the thing, who need to use it past the free allowance
 * and are not going to buy it from themselves. Kept here rather than as a
 * hand-edited Subscription row because a row says someone paid — it carries a
 * status, a period end and a Whop id — and a webhook arriving later would
 * happily overwrite the lie with the truth.
 *
 * Read from the environment so a deployment can add to it, defaulting to the
 * one account that needs it today. Matched on the verified email from the
 * session, never on anything the browser sent.
 */
const UNLIMITED = new Set(
  (process.env.UNLIMITED_EMAILS ?? 'jawad.pro17@gmail.com')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
)

/**
 * Whether this is one of those accounts.
 *
 * The id is checked against the session's own user before the email is trusted,
 * so this cannot be reached by asking about somebody else's id.
 */
async function unlimited(userId: string): Promise<boolean> {
  if (!UNLIMITED.size) return false
  try {
    const user = await currentUser()
    const email = user?.email?.toLowerCase()
    return Boolean(user?.id === userId && email && UNLIMITED.has(email))
  } catch {
    // Outside a request there are no cookies to read, and nobody to grant it to.
    return false
  }
}

export const planFor = cache(async (userId: string | null): Promise<PlanId> => {
  // Signed out is not a plan. Nothing that spends money is reachable without
  // an account, so this only happens on a deployment with auth switched off.
  if (!userId) return 'free'
  if (await unlimited(userId)) return 'pro'
  return effectivePlan(await getSubscription(userId))
})

export async function limitsFor(userId: string | null): Promise<PlanLimits> {
  return PLAN_LIMITS[await planFor(userId)]
}
