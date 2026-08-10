/**
 * Lists the Whop products and plans on this account, so the ids in .env.local
 * can be read off rather than copied out of the dashboard by eye.
 *
 *   node scripts/whop-plans.mjs
 *
 * Plan ids belong to a product, not to a company: a second app selling under
 * the same account still needs its own. Only the API key and account id carry
 * over, which is why those two are the only Whop values shared between apps.
 *
 * Reads .env.local itself — this is a plain node script, so nothing has loaded
 * the environment for it.
 */

import { readFileSync } from 'node:fs'
import { Whop } from '@whop/sdk'

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (match) process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, '')
}

const account_id = process.env.WHOP_ACCOUNT_ID?.trim()
const apiKey = process.env.WHOP_API_KEY?.trim()

if (!apiKey || !account_id) {
  console.error('WHOP_API_KEY and WHOP_ACCOUNT_ID must be set in .env.local.')
  process.exit(1)
}

const whop = new Whop({ apiKey })

/** Which env var, if any, a plan is currently wired to. The point of running
 *  this is usually to find out whether the ids in .env.local are still right. */
const WIRED = {
  [process.env.WHOP_PLAN_PRO_MONTHLY?.trim()]: 'WHOP_PLAN_PRO_MONTHLY',
  [process.env.WHOP_PLAN_PRO_YEARLY?.trim()]: 'WHOP_PLAN_PRO_YEARLY',
  [process.env.WHOP_TEST_PLAN_ID?.trim()]: 'WHOP_TEST_PLAN_ID',
}

const money = (amount, currency) =>
  `${currency.toUpperCase()} ${Number(amount).toFixed(2).replace(/\.00$/, '')}`

/** A renewal every 30 days is monthly; every 365, yearly. Spelled out because
 *  a yearly plan left on a 30-day period charges the yearly price monthly. */
const period = (plan) =>
  plan.plan_type !== 'renewal'
    ? plan.plan_type
    : plan.billing_period === 30
      ? 'every 30d (monthly)'
      : plan.billing_period === 365
        ? 'every 365d (yearly)'
        : `every ${plan.billing_period}d`

console.log(`account ${account_id}\n`)

const products = new Map()
for await (const product of whop.products.list({ account_id, first: 100 })) {
  products.set(product.id, product.title ?? product.name ?? '(untitled)')
}

const plans = []
for await (const plan of whop.plans.list({ account_id, first: 100 })) plans.push(plan)

// Grouped by product, because that is the question being asked: which plan is
// the monthly one for *this* app.
for (const [id, title] of products) {
  const mine = plans.filter((plan) => plan.product?.id === id)
  if (!mine.length) continue

  console.log(`${title}  (${id})`)
  for (const plan of mine) {
    const wired = WIRED[plan.id]
    console.log(
      `  ${plan.id}  ${money(plan.renewal_price, plan.currency).padEnd(10)}` +
        `${period(plan).padEnd(20)} ${plan.visibility}` +
        (wired ? `  ← ${wired}` : '')
    )
  }
  console.log()
}

const orphans = plans.filter((plan) => !plan.product?.id || !products.has(plan.product.id))
if (orphans.length) {
  console.log('plans with no product on this account:')
  for (const plan of orphans) console.log(`  ${plan.id}  ${money(plan.renewal_price, plan.currency)}`)
}
