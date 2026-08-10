import { db } from '@/lib/db'
import type { BillingCycle } from '@/lib/plans'
import {
  cycleFromWhopPlanId,
  unwrapWebhook,
  whop,
  whopTime,
  type WhopEvent,
} from '@/lib/whop'
import type { SubscriptionStatus } from '@/lib/generated/prisma/client'

export const runtime = 'nodejs'

// Where a purchase becomes a plan.
//
// Everything the app charges for is decided by the `subscriptions` table
// (lib/subscription.ts), and this route is the only thing that writes to it.
// Whop is the source of truth for the money; this keeps our row saying what
// theirs says.
//
// Three events matter, and all three carry a full membership — the only object
// with everything on it: who, which plan, and until when.
//
//   membership.activated                     a plan starts
//   membership.cancel_at_period_end_changed  they cancelled, or changed back
//   membership.deactivated                   it is over
//
// `payment.succeeded` is handled as a renewal signal only: a payment carries
// no period end, so the membership behind it is fetched to find out how far
// the clock moved. Everything else is acknowledged and dropped — a 200 that
// means "heard you", not "did something".
//
// Nothing here trusts delivery. Whop can send these twice, out of order, or
// not at all, so every write is an upsert that can run again harmlessly and
// `currentPeriodEnd` only ever moves forward. The backstop for a webhook that
// never arrives is in `effectivePlan()`: a period that has run out reads as
// free whatever this table says.

type WhopMembership = Extract<WhopEvent, { type: 'membership.activated' }>['data']

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim()
  if (!secret) {
    console.error('WHOP_WEBHOOK_SECRET is not set — webhook refused.')
    return new Response('Not configured', { status: 503 })
  }

  // The raw text, before anything parses it: the signature is over the exact
  // bytes sent, so a re-serialised body would never verify.
  const body = await request.text()

  let event: WhopEvent
  try {
    event = unwrapWebhook(body, Object.fromEntries(request.headers), secret)
  } catch (error) {
    // Either it is not from Whop or the secret is wrong. Both are a 400: a
    // retry of the same request would fail the same way.
    console.error('Rejected a Whop webhook:', error)
    return new Response('Bad signature', { status: 400 })
  }

  try {
    await handle(event)
  } catch (error) {
    // Answer 200 anyway. Whop retries a failure, and a bug in here would
    // otherwise be replayed every few minutes without ever succeeding.
    console.error(`Whop ${event.type} (${event.id}) could not be handled:`, error)
  }

  return new Response('ok')
}

async function handle(event: WhopEvent): Promise<void> {
  switch (event.type) {
    case 'membership.activated':
    case 'membership.cancel_at_period_end_changed':
    case 'membership.deactivated':
      await record(event.data)
      return

    case 'payment.succeeded': {
      // A renewal. The payment says money arrived but not what it bought a
      // month of, so the membership is read back for its new period end.
      const membershipId = event.data.membership?.id
      if (!membershipId) return

      const membership = await whop().memberships.retrieve(membershipId)
      await record(membership as WhopMembership, event.data.metadata)
      return
    }

    default:
      return
  }
}

/**
 * Writes a membership into the `subscriptions` table.
 *
 * `fallback` is the metadata from a payment, used when the membership itself
 * has none — the same keys, since both inherit them from the checkout.
 */
async function record(
  membership: WhopMembership,
  fallback?: Record<string, unknown> | null
): Promise<void> {
  // A membership Whop has drawn up but nobody has paid for yet. Writing the
  // row now would hand out the plan.
  if (membership.status === 'drafted') return

  const metadata = { ...(fallback ?? {}), ...(membership.metadata ?? {}) }
  const userId = whose(membership, metadata)

  if (!userId) {
    // Someone paid and we cannot tell who. Loud, because it is money in the
    // account with nobody getting anything for it, and the fix is by hand.
    console.error(
      `Whop membership ${membership.id} matches no account ` +
        `(metadata userId: ${String(metadata.userId ?? 'none')}, ` +
        `email: ${membership.user?.email ?? 'none'}).`
    )
    return
  }

  const existing = await db.subscription.findUnique({ where: { userId } })

  // Only ever forward: a webhook that arrives out of order cannot shorten a
  // period already paid for.
  const currentPeriodEnd = later(
    existing?.currentPeriodEnd ?? null,
    whopTime(membership.renewal_period_end)
  )

  const fields = {
    plan: 'pro' as const,
    cycle: cycle(membership, metadata),
    status: status(membership.status),
    cancelAtPeriodEnd: Boolean(membership.cancel_at_period_end),
    currentPeriodEnd,
    subscriptionId: membership.id,
    customerId: membership.user?.id ?? null,
    email: membership.user?.email ?? null,
  }

  await db.subscription.upsert({
    where: { userId },
    create: { userId, ...fields },
    update: fields,
  })
}

/**
 * Whose purchase this is.
 *
 * The user id in the metadata is the real answer — the app put it there when
 * it built the checkout, so it cannot be anyone else's. There is no users
 * table to fall back to here (identity lives in Supabase), so a purchase made
 * through a pasted checkout link carries only an email, and that is recorded
 * on the row rather than guessed at.
 */
function whose(membership: WhopMembership, metadata: Record<string, unknown>): string | null {
  const userId = metadata.userId
  if (typeof userId === 'string' && userId.trim()) return userId.trim()

  // No id: nothing here can safely decide which account this belongs to.
  // Logged by the caller, granted by hand.
  return null
}

/** Which cycle was bought. The plan id on the membership wins: it is what the
 *  money actually went to, where metadata is only what the app asked for. */
function cycle(membership: WhopMembership, metadata: Record<string, unknown>): BillingCycle {
  const fromPlan = cycleFromWhopPlanId(membership.plan?.id)
  if (fromPlan) return fromPlan
  return metadata.cycle === 'yearly' ? 'yearly' : 'monthly'
}

/** Whop's membership status, as ours. Anything unrecognised is treated as over
 *  rather than active — the safe direction. */
function status(value: string | null | undefined): SubscriptionStatus {
  switch (value) {
    case 'active':
    case 'completed':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'past_due':
    case 'unresolved':
      return 'past_due'
    case 'canceled':
    case 'cancelled':
      return 'canceled'
    default:
      return 'expired'
  }
}

const later = (a: Date | null, b: Date | null) =>
  !a ? b : !b ? a : a.getTime() >= b.getTime() ? a : b
