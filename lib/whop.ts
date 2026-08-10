import 'server-only'

import Whop from '@whop/sdk'
import { Webhook } from 'standardwebhooks'

import type { BillingCycle } from './plans'

// The billing provider, and the one place that knows which Whop plan is which
// of ours.
//
// Nothing here throws at import time: the app has to run with none of it set,
// which is what a deployment with checkout switched off looks like.

/**
 * The two plans that can be bought. Yearly is a separate Whop plan rather than
 * a modifier, because that is what it is on their side too.
 *
 * Each is either a plan id (`plan_…`) or a checkout link copied out of the
 * dashboard, and which one decides how much the app can know about the sale —
 * see `checkoutTarget`.
 */
const PLAN_ENV: Record<BillingCycle, string | undefined> = {
  monthly: process.env.WHOP_PLAN_PRO_MONTHLY,
  yearly: process.env.WHOP_PLAN_PRO_YEARLY,
}

/**
 * Where a plan's button leads, and how much the app will know about the sale.
 *
 *  - `plan` — a plan id. The app builds a checkout per click and stamps it
 *    with the buyer's user id, so the webhook can put the plan on exactly the
 *    right account. Prefer this.
 *  - `link` — a checkout link pasted from the dashboard. Nothing can be
 *    attached to it, so the purchase comes back carrying only what Whop knows
 *    about the buyer and fulfilment falls back to matching their email. It
 *    also works for anyone who finds the link without going through the app,
 *    which is why the webhook has to cope either way.
 */
export function checkoutTarget(
  cycle: BillingCycle
): { kind: 'plan'; planId: string } | { kind: 'link'; url: string } | undefined {
  const value = PLAN_ENV[cycle]?.trim()
  if (!value) return undefined

  if (value.startsWith('plan_')) return { kind: 'plan', planId: value }
  if (/^https?:\/\//.test(value)) return { kind: 'link', url: value }

  // Neither. Treating it as a plan id would send buyers to a 404.
  console.error(`WHOP_PLAN_PRO_${cycle.toUpperCase()} is neither a plan_ id nor a URL.`)
  return undefined
}

/**
 * The reverse: which cycle a Whop plan id is.
 *
 * The webhook trusts this over the metadata it sent along with the checkout.
 * Metadata says what we asked for; the plan id on the membership says what
 * they actually bought, and when the two disagree the money is the truth.
 */
export function cycleFromWhopPlanId(id: string | null | undefined): BillingCycle | null {
  if (!id) return null

  for (const [cycle, value] of Object.entries(PLAN_ENV)) {
    // Only the ones configured as ids can answer this. A checkout link is a
    // different kind of string that happens to live in the same variable.
    if (value?.trim().startsWith('plan_') && value.trim() === id) return cycle as BillingCycle
  }
  return null
}

/**
 * A stand-in plan, for walking the real buttons end to end.
 *
 * Whop has no sandbox and no test cards, and its risk engine blocks a merchant
 * buying their own product — which leaves no way to press Checkout on the live
 * site and watch a plan arrive. This swaps the plan behind the button for a
 * free one, so the whole path runs for real: same action, same checkout, same
 * webhook, same row at the end. Only the charge is missing.
 *
 * Named accounts only, never a blanket switch: pointing the paid plans at a $0
 * plan on a live site is how you give the product away to everyone who wanders
 * past the pricing page.
 */
export function testPlanFor(email: string | null | undefined): string | undefined {
  const plan = process.env.WHOP_TEST_PLAN_ID?.trim()
  if (!plan || !email) return undefined

  const allowed = (process.env.WHOP_TEST_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

  return allowed.includes(email.trim().toLowerCase()) ? plan : undefined
}

/** The company the plans belong to, prefixed `biz_`. */
export const whopAccountId = process.env.WHOP_ACCOUNT_ID?.trim() || undefined

/** What is missing before a checkout can be built through the API at all. */
export function apiMisconfiguration(): string | null {
  if (!process.env.WHOP_API_KEY?.trim()) return 'WHOP_API_KEY is not set'
  if (!whopAccountId) return 'WHOP_ACCOUNT_ID is not set'
  return null
}

/**
 * Whether this deployment is wired up enough to sell this cycle.
 *
 * Checked before a checkout starts, so a half-filled `.env` fails at the
 * button rather than at Whop's door. A pasted link needs nothing but itself; a
 * plan id needs a key to build a checkout with and an account to build it under.
 */
export function checkoutMisconfiguration(cycle: BillingCycle): string | null {
  const target = checkoutTarget(cycle)
  if (!target) return `nothing configured for ${cycle}`
  if (target.kind === 'link') return null
  return apiMisconfiguration()
}

let client: Whop | undefined

/** The API client, made on first use — so importing this module on a
 *  deployment that is not selling anything does not require a key. */
export function whop(): Whop {
  if (!client) {
    const apiKey = process.env.WHOP_API_KEY?.trim()
    if (!apiKey) throw new Error("WHOP_API_KEY is not set — checkout can't be started.")
    client = new Whop({ apiKey })
  }
  return client
}

/** What `whop().webhooks.unwrap()` would have returned, had it worked. */
export type WhopEvent = ReturnType<Whop['webhooks']['unwrap']>

/**
 * Checks a webhook's signature and returns the event inside it.
 *
 * This ought to be `whop().webhooks.unwrap(...)`, and is not, because that
 * throws on Whop's own secrets: webhooks here follow the Standard Webhooks
 * spec, whose secrets are base64 behind a `whsec_` prefix, while Whop issues
 * `ws_` followed by hex — and the library strips only the prefix it knows
 * before base64-decoding, so the decode fails before a signature is computed.
 *
 * Which derivation Whop signs with is not documented, so each plausible one is
 * tried: it is the same HMAC comparison every time, and an attacker without
 * the secret cannot produce a signature that matches under any of them.
 */
export function unwrapWebhook(
  body: string,
  headers: Record<string, string>,
  secret: string
): WhopEvent {
  const bare = secret.replace(/^ws_/, '')

  const candidates: [string, Uint8Array][] = [
    ['raw secret', bytes(secret)],
    ['raw, prefix stripped', bytes(bare)],
    ['hex, prefix stripped', new Uint8Array(Buffer.from(bare, 'hex'))],
    ['base64, prefix stripped', new Uint8Array(Buffer.from(bare, 'base64'))],
  ]

  let last: unknown
  for (const [name, key] of candidates) {
    try {
      const event = new Webhook(key, { format: 'raw' }).verify(body, headers) as WhopEvent
      if (!reported) {
        console.info(`Whop webhook signatures verify with the ${name}.`)
        reported = true
      }
      return event
    } catch (error) {
      last = error
    }
  }

  throw last instanceof Error ? last : new Error('Signature did not verify')
}

let reported = false

const bytes = (value: string) => Uint8Array.from(value, (char) => char.charCodeAt(0))

/**
 * A time Whop sent us, as a Date.
 *
 * `renewal_period_end` is typed as a string and documented as a Unix
 * timestamp, which is two different things and only one of them parses. All
 * digits is seconds since the epoch; anything else is left to `Date` and
 * checked, because an Invalid Date written into `currentPeriodEnd` would read
 * as an expired plan and quietly take away what someone just paid for.
 */
export function whopTime(value: string | null | undefined): Date | null {
  if (!value) return null

  const date = /^\d+$/.test(value) ? new Date(Number(value) * 1000) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
