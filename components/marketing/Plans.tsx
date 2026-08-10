import Link from 'next/link'
import { PLAN_LIMITS, PRICES, YEARLY_SAVING, type BillingCycle } from '@/lib/plans'
import { CheckoutButton } from './CheckoutButton'

/**
 * What it costs.
 *
 * Two cards rather than one price behind a toggle. A toggle hides half the
 * offer until someone thinks to flip it, and the only decision here — commit
 * for a month or for a year — is exactly the kind you make by putting the two
 * side by side and looking at them.
 *
 * One product either way: the list is identical on both cards on purpose,
 * because it is. The yearly card earns its badge on price alone.
 */

/** From the same place the server reads them, so the card cannot promise
 *  something the quota then refuses. */
const FREE_MAPS = PLAN_LIMITS.free.mindmaps
const FREE_LESSONS = PLAN_LIMITS.free.lessons

const MONTHLY = PRICES.monthly
const YEARLY = PRICES.yearly
const SAVED = YEARLY_SAVING

/**
 * What the free plan is, said as a plan rather than as a footnote.
 *
 * It was a sentence under the paid cards with a button beside it, which fixed
 * the real problem — the one path that costs nothing was the only one you
 * could not take from here — but left it looking like a disclaimer. As a card
 * it is what it actually is: the plan everybody starts on.
 *
 * Its list is the paid list with the two limits swapped in at the top, so the
 * three cards read down as the same product with one line changed — which is
 * the truth, and is more persuasive than a shorter list would be.
 */
const FREE_INCLUDED = [
  `${FREE_MAPS} maps and ${FREE_LESSONS} lessons to make, in total`,
  'Every branch opens further — as deep as you want',
  'Explanations written for the far edges, not just labels',
  'Hand-drawn boards, narrated as they are drawn',
]

const INCLUDED = [
  'Unlimited maps, lessons and worked solutions',
  'Every branch opens further — as deep as you want',
  'Explanations written for the far edges, not just labels',
  'Hand-drawn boards, narrated as they are drawn',
  'Your whole history, on every machine you sign in from',
]

/**
 * @param compact inside a dialog rather than on a page — the same two cards,
 *   sized so both fit above the fold of a modal instead of filling a section.
 */
export function Plans({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`mx-auto grid w-full gap-6 sm:grid-cols-3 ${
        compact ? 'max-w-[1000px]' : 'max-w-[1180px] sm:gap-7'
      }`}
    >
      <Card
        name="Free"
        price="$0"
        per="/mo"
        note="No card. Enough to find out whether this is for you."
        cta="Start free"
        items={FREE_INCLUDED}
        quiet
        compact={compact}
      />
      <Card
        name="Monthly"
        price={`$${MONTHLY}`}
        per="/mo"
        note="Billed every month. Stop whenever you like."
        cycle="monthly"
        compact={compact}
      />
      <Card
        name="Yearly"
        price={`$${YEARLY}`}
        per="/yr"
        note={`That's $${(YEARLY / 12).toFixed(2)} a month — $${SAVED} less than paying monthly.`}
        badge="Best Value!"
        featured
        cycle="yearly"
        compact={compact}
      />

    </div>
  )
}

function Card({
  name,
  price,
  per,
  note,
  badge,
  featured = false,
  compact = false,
  cta = 'Checkout',
  items = INCLUDED,
  quiet = false,
  cycle,
}: {
  name: string
  price: string
  per: string
  note: string
  badge?: string
  featured?: boolean
  compact?: boolean
  /** What the button says. Nobody "checks out" of a free plan. */
  cta?: string
  items?: readonly string[]
  /**
   * An outlined button rather than the filled one.
   *
   * Three identical blue buttons make the free plan look like the thing being
   * sold. It is a way in, so it is drawn as one.
   */
  quiet?: boolean
  /** What pressing the button buys. Absent on the free card, which sells nothing. */
  cycle?: BillingCycle
}) {
  return (
    <section
      className={`relative rounded-[34px] border border-zinc-900/[0.08] bg-white shadow-[0_12px_30px_rgba(71,96,145,.14),0_2px_6px_rgba(46,62,93,.05)] ${
        compact ? 'p-6 pb-24' : 'p-7 pb-28'
      } ${featured && !compact ? 'sm:-mt-3' : ''}`}
    >
      {/* Over the card's edge rather than inside it: the overlap is what makes
          a badge read as applied to the card instead of printed on it. */}
      {badge && (
        <span className="absolute -top-[26px] right-10 flex h-[51px] min-w-[157px] items-center justify-center whitespace-nowrap rounded-[15px] border-[1.5px] border-[#bcd7f4] bg-[#f5fbff] px-4 text-[19px] text-[#0864cf] shadow-[0_3px_5px_rgba(79,119,171,.13)]">
          {badge}
        </span>
      )}

      <h3 className={`font-bold leading-tight text-zinc-900 ${compact ? 'text-[22px]' : 'text-[26px]'}`}>
        {name}
      </h3>

      <div className="mt-4 flex items-end gap-1.5">
        <span
          className={`font-semibold leading-[0.95] tracking-[-2.4px] text-zinc-900 ${
            compact ? 'text-[46px]' : 'text-[58px]'
          }`}
        >
          {price}
        </span>
        <span className={`mb-1.5 leading-none text-[#2e3748] ${compact ? 'text-[22px]' : 'text-[28px]'}`}>
          {per}
        </span>
      </div>

      <p className={`mt-4 leading-snug text-[#3e4658] ${compact ? 'text-[15px]' : 'text-[19px]'}`}>
        {note}
      </p>

      <ul className={`flex flex-col ${compact ? 'mt-5 gap-3' : 'mt-7 gap-4'}`}>
        {items.map((line) => (
          <li
            key={line}
            className={`flex items-start gap-3 leading-snug text-[#21262f] ${
              compact ? 'text-[14px]' : 'text-[17px]'
            }`}
          >
            <span
              className={`mt-0.5 inline-flex shrink-0 items-center justify-center rounded-full border-[3px] border-[#14bf67] text-[#14bf67] ${
                compact ? 'size-[24px]' : 'size-[30px]'
              }`}
            >
              <svg
                viewBox="0 0 20 20"
                className={compact ? 'size-3' : 'size-3.5'}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m4.5 10.5 4 4 7-9" />
              </svg>
            </span>
            {line}
          </li>
        ))}
      </ul>

      {cycle ? (
        <CheckoutButton
          cycle={cycle}
          label={cta}
          className={`absolute inset-x-6 bottom-6 flex items-center justify-center rounded-[18px] bg-gradient-to-b from-[#2f70ee] to-[#2363df] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15)] transition hover:brightness-[1.06] ${
            compact ? 'h-[58px] text-[19px]' : 'h-[72px] text-[24px]'
          }`}
        />
      ) : (
      <Link
        href="/login?next=/mindmap"
        className={`absolute inset-x-6 bottom-6 flex items-center justify-center rounded-[18px] font-semibold transition ${
          quiet
            ? 'border border-[#d7dbe6] bg-white text-[#22304a] hover:border-[#b9c2d4]'
            : 'bg-gradient-to-b from-[#2f70ee] to-[#2363df] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15)] hover:brightness-[1.06]'
        } ${compact ? 'h-[58px] text-[19px]' : 'h-[72px] text-[24px]'}`}
      >
        {cta}
      </Link>
      )}
    </section>
  )
}

/**
 * The field the cards sit on.
 *
 * Two soft blue washes over an almost-white page. Exported separately because
 * the landing page and /pricing both need it, and neither should be pasting
 * gradient stops into a className.
 */
export function PlansBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        background:
          'radial-gradient(720px 520px at 75% 2%, rgba(96,142,255,.37), rgba(96,142,255,.12) 52%, rgba(96,142,255,0) 78%), radial-gradient(620px 650px at 45% 56%, rgba(86,141,255,.24), rgba(86,141,255,.08) 55%, rgba(86,141,255,0) 80%), linear-gradient(180deg,#f7f9fd 0%,#f7f8fb 100%)',
      }}
    >
      {children}
    </div>
  )
}
