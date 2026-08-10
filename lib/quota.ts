import { db } from './db'
import { owned, type Identity } from './owner'
import { limitsFor } from './subscription'

/**
 * What the free plan allows.
 *
 * Counted against what has ever been made, not what is still kept. Deleting a
 * map does not give the slot back: the free tier is an allowance to try the
 * thing five times, and a limit that resets on delete is not a limit at all —
 * it only caps how many you hold at once, and anyone can have as many as they
 * like by tidying up in between.
 *
 * The tally lives in its own table (`Usage`) precisely because it has to
 * outlive the rows it counted. The limits themselves come from lib/plans.ts
 * and the plan from lib/subscription.ts, so a paid account has an infinite
 * ceiling and never counts anything at all.
 */

export const FREE_LIMITS = { mindmaps: 5, lessons: 2 } as const

export type Countable = keyof typeof FREE_LIMITS

export interface Allowance {
  ok: boolean
  used: number
  limit: number
}

/** The key a tally is filed under: the account when there is one, the browser
 *  before that. Same rule as ownership, so a claim carries the count with it. */
const keyOf = (identity: Identity) => identity.userId ?? identity.ownerKey

export async function allowance(identity: Identity, kind: Countable): Promise<Allowance> {
  // What the account is actually paying for, not what the free plan allows —
  // this is the line the Whop webhook moves when somebody buys.
  const limit = (await limitsFor(identity.userId))[kind]
  if (!Number.isFinite(limit)) return { ok: true, used: 0, limit }

  const [tally, live] = await Promise.all([
    db.usage.findUnique({ where: { owner: keyOf(identity) } }),
    kind === 'mindmaps'
      ? db.mindmap.count({ where: owned(identity) })
      : db.lesson.count({ where: owned(identity) }),
  ])

  // The higher of the two, which is what makes this safe to switch on midway.
  // Anything made before this table existed was never tallied, so the tally
  // reads zero while five maps sit there; counting the rows as well means an
  // existing account does not silently get its allowance back. Once the tally
  // has caught up it only ever leads, because it is the one that never drops.
  const used = Math.max(tally?.[kind] ?? 0, live)

  return { ok: used < limit, used, limit }
}

/**
 * Records that one was made. Called after the row is written, never before —
 * a creation that fails should not cost anyone part of their allowance.
 *
 * `increment` rather than a read and a write, so two maps saved at the same
 * moment cannot both read four and both store five.
 */
export async function spend(identity: Identity, kind: Countable): Promise<void> {
  const owner = keyOf(identity)

  try {
    await db.usage.upsert({
      where: { owner },
      create: { owner, [kind]: 1 },
      update: { [kind]: { increment: 1 } },
    })
  } catch (error) {
    // The thing they asked for already exists and is theirs. Losing count of
    // it is not worth failing the request they actually made.
    console.error(`[quota] could not record a ${kind} for ${owner}`, error)
  }
}

/** What to say when someone is at the limit. Names the way out, not just the wall. */
export function atLimit(kind: Countable, limit: number) {
  const thing = kind === 'mindmaps' ? 'maps' : 'lessons'
  return `The free plan includes ${limit} ${thing}. Upgrade for unlimited.`
}
