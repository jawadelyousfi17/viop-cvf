// The plans, the prices, and what each one allows.
//
// Imported by the pricing cards, so everything here is safe in a client
// bundle: names, prices, limits, and whether the shop is open. The Whop plan
// ids are not — they live in lib/whop.ts behind `server-only`, because a plan
// id read from `process.env` in a browser bundle is `undefined` rather than a
// plan id.

export type BillingCycle = 'monthly' | 'yearly'

/** Matches the `PlanId` enum in prisma/schema.prisma, so a row read out of the
 *  database is already one of these. */
export type PlanId = 'free' | 'pro'

/**
 * What a plan allows. `Infinity` where there is no cap.
 *
 * These are the numbers lib/quota.ts actually enforces, and what the cards are
 * written from — so the page cannot promise something the server then refuses.
 */
export interface PlanLimits {
  /** Mindmaps this plan may ever make. Deleting one does not give it back. */
  mindmaps: number
  /** Lessons this plan may ever make. Deleting one does not give it back. */
  lessons: number
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { mindmaps: 5, lessons: 2 },
  pro: { mindmaps: Infinity, lessons: Infinity },
}

/** Dollars. Monthly is per month; yearly is the whole year, paid up front. */
export const PRICES = { monthly: 30, yearly: 299 } as const

/** Two months and change, worth saying in money rather than as a percentage. */
export const YEARLY_SAVING = PRICES.monthly * 12 - PRICES.yearly

/**
 * Whether a paid plan can actually be bought.
 *
 * False and the cards still say what it costs, with the button held shut
 * rather than pointing somewhere that cannot take the money. Read from the
 * environment because the answer is a property of the deployment and not of
 * the code: the buttons should open on a site whose Whop plans exist and stay
 * shut on one where they do not, and both are this repo.
 *
 * `NEXT_PUBLIC_` because the cards are a client component and this decides
 * what they draw. It says nothing secret — only whether the shop is open,
 * which anyone can see by looking at it.
 */
/**
 * A shop-is-shut switch, above the environment.
 *
 * Held closed on purpose while the plans behind the buttons are sorted out —
 * the yearly plan currently renews every 30 days, so buying it would charge
 * the yearly price monthly. Nothing is wrong with the code path; it is the
 * thing being sold that is not ready, and the environment cannot say that
 * because the environment is where "ready" is configured.
 *
 * Flip to true to reopen. The env var still has to agree, so a deployment
 * without plan ids stays shut regardless.
 */
const OPEN_FOR_BUSINESS = false

export const CHECKOUT_ENABLED =
  OPEN_FOR_BUSINESS && process.env.NEXT_PUBLIC_CHECKOUT_ENABLED === 'true'

/**
 * Which cycles can be bought, when checkout is open at all.
 *
 * A cycle can exist as a price without existing as something to buy: yearly is
 * the better deal and the reason to look twice, so it keeps its figure and its
 * saving while there is nothing behind it yet. The button is the part that has
 * to be honest.
 */
export const SELLABLE_CYCLES: readonly BillingCycle[] = (
  process.env.NEXT_PUBLIC_CHECKOUT_CYCLES ?? 'monthly,yearly'
)
  .split(',')
  .map((cycle) => cycle.trim())
  .filter((cycle): cycle is BillingCycle => cycle === 'monthly' || cycle === 'yearly')

export const canBuy = (cycle: BillingCycle) =>
  CHECKOUT_ENABLED && SELLABLE_CYCLES.includes(cycle)
