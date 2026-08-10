'use server'

import { currentUser } from '@/lib/supabase/server'
import { canBuy, type BillingCycle } from '@/lib/plans'
import { planFor } from '@/lib/subscription'
import {
  apiMisconfiguration,
  checkoutMisconfiguration,
  checkoutTarget,
  testPlanFor,
  whop,
  whopAccountId,
} from '@/lib/whop'

// Starting a checkout: what happens between pressing Checkout and arriving at
// Whop's payment page.
//
// The button does not know a Whop plan id and cannot be told one — this
// resolves it server-side from the cycle it was given, which is checked rather
// than trusted. So the worst a forged call can do is start a checkout for a
// plan that is already on sale at the price already published.
//
// The purchase URL comes back to the caller instead of being redirected to.
// It is a different origin, and a returned URL the client navigates to is
// plainer than relying on how a cross-origin redirect behaves inside a
// transition — the button knows it is leaving the site.

export type CheckoutResult =
  | { ok: true; url: string }
  /** `signIn` carries where to send someone who is not signed in yet:
   *  metadata needs a user id to carry, so there is no checkout without one. */
  | { ok: false; error: string; signIn?: string }

export async function startCheckout(cycle: BillingCycle): Promise<CheckoutResult> {
  if (cycle !== 'monthly' && cycle !== 'yearly') {
    return { ok: false, error: "That plan isn't for sale." }
  }
  if (!canBuy(cycle)) {
    return { ok: false, error: 'Checkout is not open yet.' }
  }

  const user = await currentUser()
  if (!user) {
    return {
      ok: false,
      error: 'Sign in first, so the plan lands on your account.',
      signIn: '/login?next=/pricing',
    }
  }

  // A tester on the list buys the free stand-in instead, at the price of
  // nothing, and gets the plan at the end of it. Everyone else buys the card.
  const testPlan = testPlanFor(user.email)

  const missing = testPlan ? apiMisconfiguration() : checkoutMisconfiguration(cycle)
  if (missing) {
    // Not the buyer's problem and not something to spell out to them: the
    // sentence they read is the one any other outage gets, and the reason goes
    // to the logs where whoever deploys this will find it.
    console.error(`Checkout is not configured: ${missing}.`)
    return { ok: false, error: 'Payments are briefly unavailable.' }
  }

  if ((await planFor(user.id)) === 'pro') {
    return { ok: false, error: "You're already on the paid plan." }
  }

  const target = testPlan
    ? ({ kind: 'plan', planId: testPlan } as const)
    : checkoutTarget(cycle)!

  if (testPlan) {
    console.warn(`Checkout for ${user.email} is using the free test plan ${testPlan}.`)
  }

  // A link out of the dashboard is already the answer, and there is nothing to
  // stamp it with. Whoever buys through it is matched back by email when the
  // webhook lands.
  if (target.kind === 'link') return { ok: true, url: target.url }

  // Whop refuses a redirect that is not https, which http://localhost:3000 is
  // not. Sent when there is somewhere real to come back to and left off when
  // there is not, so a checkout can still be walked through locally — it ends
  // on Whop's own receipt instead of back in the app.
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const redirect_url = origin?.startsWith('https://') ? `${origin}/mindmap` : undefined

  try {
    const configuration = await whop().checkoutConfigurations.create({
      account_id: whopAccountId,
      plan_id: target.planId,
      // Copied onto every payment and membership this checkout produces, which
      // is the whole reason for going through the API rather than a pasted
      // link: it is how the webhook knows whose account just got paid for.
      metadata: { userId: user.id, plan: 'pro', cycle },
      redirect_url,
    })

    if (!configuration.purchase_url) throw new Error(`no purchase_url on ${configuration.id}`)
    return { ok: true, url: configuration.purchase_url }
  } catch (error) {
    console.error('Whop checkout could not be created:', error)
    return { ok: false, error: 'Payments are briefly unavailable.' }
  }
}
