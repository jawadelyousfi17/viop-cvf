// Lists the plans on your Whop account, with their ids.
//
// The ids are what `WHOP_PLAN_BASIC_MONTHLY` and the other three want, and
// they aren't the thing the dashboard offers you to copy — that's a checkout
// link, which works but can't be stamped with who's buying (see lib/whop.ts).
// This asks the API instead and prints them beside the price and the period,
// so it's obvious which is which.
//
//   npm run whop:plans
//
// Needs WHOP_API_KEY and WHOP_ACCOUNT_ID in .env. Reads nothing else and
// changes nothing.

import "dotenv/config";
import Whop from "@whop/sdk";

async function main() {
  const apiKey = process.env.WHOP_API_KEY?.trim();
  const accountId =
    process.argv[2]?.trim() || process.env.WHOP_ACCOUNT_ID?.trim();

  if (!apiKey || !accountId) {
    throw new Error(
      "Set WHOP_API_KEY and WHOP_ACCOUNT_ID in .env first — both are in the " +
        "Whop dashboard under Settings. Usage: npm run whop:plans [biz_…]",
    );
  }

  const whop = new Whop({ apiKey });

  let found = 0;
  for await (const plan of whop.plans.list({ account_id: accountId })) {
    found += 1;

    // `billing_period` is a number of days on a recurring plan and null on a
    // one-off, which is the only reliable way to tell monthly from yearly
    // here — the title is whatever it was named in the dashboard.
    const period =
      plan.billing_period === null
        ? plan.plan_type
        : `every ${plan.billing_period} days`;

    console.log(
      [
        plan.id.padEnd(28),
        `${plan.renewal_price || plan.initial_price} ${plan.currency.toUpperCase()}`.padEnd(
          12,
        ),
        period.padEnd(18),
        plan.title ?? "(untitled)",
      ].join(" "),
    );
  }

  if (!found) {
    console.log(`No plans on ${accountId} yet — create them in the dashboard.`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});