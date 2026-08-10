import { db } from './db'
import { owned, type Identity } from './owner'
import { limitsFor } from './subscription'

/**
 * What the free plan allows.
 *
 * Counted against what is *kept*, not what has ever been made: delete a map
 * and the slot comes back. That is the honest reading of "up to five", and it
 * means nobody is locked out by things they no longer want.
 *
 * The limits themselves come from lib/plans.ts and the plan from
 * lib/subscription.ts, so a paid account simply has an infinite ceiling and
 * never counts anything.
 */

export const FREE_LIMITS = { mindmaps: 5, lessons: 2 } as const

export type Countable = keyof typeof FREE_LIMITS

export interface Allowance {
  ok: boolean
  used: number
  limit: number
}

export async function allowance(identity: Identity, kind: Countable): Promise<Allowance> {
  // What the account is actually paying for, not what the free plan allows —
  // this is the line the Whop webhook moves when somebody buys.
  const limit = (await limitsFor(identity.userId))[kind]
  if (!Number.isFinite(limit)) return { ok: true, used: 0, limit }

  const where = owned(identity)

  const used = kind === 'mindmaps' ? await db.mindmap.count({ where }) : await db.lesson.count({ where })

  return { ok: used < limit, used, limit }
}

/** What to say when someone is at the limit. Names the way out, not just the wall. */
export function atLimit(kind: Countable, limit: number) {
  const thing = kind === 'mindmaps' ? 'maps' : 'lessons'
  return `The free plan keeps ${limit} ${thing}. Delete one, or upgrade for unlimited.`
}
