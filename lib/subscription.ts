import 'server-only'

import { cache } from 'react'
import { db } from './db'
import { PLAN_LIMITS, type PlanId, type PlanLimits } from './plans'
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

export const planFor = cache(async (userId: string | null): Promise<PlanId> => {
  // Signed out is not a plan. Nothing that spends money is reachable without
  // an account, so this only happens on a deployment with auth switched off.
  if (!userId) return 'free'
  return effectivePlan(await getSubscription(userId))
})

export async function limitsFor(userId: string | null): Promise<PlanLimits> {
  return PLAN_LIMITS[await planFor(userId)]
}
