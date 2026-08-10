import Link from 'next/link'
import type { Metadata } from 'next'
import { Logo } from '@/components/ui/Logo'
import { BetaBadge } from '@/components/ui/BetaBadge'
import { RaiseCard } from '@/components/marketing/RaiseCard'
import { BoardDemo } from '@/components/marketing/BoardDemo'
import { Founder } from '@/components/marketing/Founder'
import { mailto } from '@/lib/contact'

export const metadata: Metadata = {
  title: 'Invest in nipsol',
  description: 'nipsol is raising. What we are building, and how to talk to us about it.',
}

/**
 * The raise, as a page.
 *
 * Everything here is either true or clearly marked as not filled in yet. That
 * is not squeamishness: a raise page is the one place where an invented number
 * is fraud rather than marketing, and the people it is aimed at check. So
 * there is no traction section, no revenue, no logos, and the figures below
 * live in one block at the top of this file for a human to fill in with real
 * ones — an empty field reads as early, which we are, where a made-up one
 * reads as a liar, which we are not.
 */

/**
 * The numbers on the card.
 *
 * FILL THESE IN before sharing the page. They are deliberately vague rather
 * than invented — say the round size and the terms only when they are decided.
 */
const FACTS = [
  { label: 'Stage', value: 'Pre-seed' },
  { label: 'Raising', value: 'Open' },
  { label: 'Instrument', value: 'SAFE' },
  { label: 'Minimum', value: 'Flexible' },
]

/** Why this is worth an hour of an investor's time. All of it checkable. */
const REASONS = [
  {
    title: 'It teaches, rather than answering',
    body: 'Every other AI product returns a wall of text. nipsol draws the thing on a board and talks you through it as it goes — the format people have learned from for a century, which nobody had built for a model that can now actually do it.',
  },
  {
    title: 'The hard part is built and working',
    body: 'A lesson is written, laid out, drawn and narrated in sync, in the browser, today. Mindmaps expand infinitely as you open branches. A maths tutor works problems a line at a time in real notation. It is live, and you can use it in the next two minutes.',
  },
  {
    title: 'The rendering is ours',
    body: 'The board is our own engine — hand-drawn geometry, camera, typesetting, plots — not a licensed canvas. That is a moat in the ordinary sense: everything we learn about how a board should read goes straight into it, and it costs us nothing per seat.',
  },
  {
    title: 'The market is everyone who has ever been stuck',
    body: 'Students, career switchers, engineers reading an unfamiliar system, anyone who has watched a lecture twice and still not got it. We are not betting on a new behaviour — we are making an old one work better.',
  },
]

export default function FundraisingPage() {
  return (
    <main className="min-h-dvh bg-[#f7f9fd]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <Logo height={26} href="/" />
          <BetaBadge />
        </div>
        <nav className="flex items-center gap-5 text-sm text-zinc-500">
          <Link href="/pricing" className="transition hover:text-zinc-900">
            Pricing
          </Link>
          <Link href="/contact" className="transition hover:text-zinc-900">
            Contact
          </Link>
          <Link
            href="/login?next=/mindmap"
            className="flex h-9 items-center rounded-xl bg-zinc-900 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-700"
          >
            Try it
          </Link>
        </nav>
      </header>

      {/* The hero: what it is, next to the thing itself doing it. A raise page
          whose first illustration is a stock photo is one where the product is
          not ready to be shown. */}
      <section className="mx-auto w-full max-w-6xl px-6">
        <div className="grid items-center gap-10 rounded-[34px] bg-white p-9 shadow-[0_12px_30px_rgba(71,96,145,.10)] lg:grid-cols-[1.05fr_1fr] lg:p-12">
          <div>
            <span className="inline-flex h-7 items-center rounded-full border border-[#bfe3cd] bg-[#f2fdf6] px-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0f8a4a]">
              Raising now
            </span>
            <h1 className="mt-5 text-[38px] font-semibold leading-[1.1] tracking-tight text-zinc-900 sm:text-[46px]">
              An AI teacher that draws on the board while it explains.
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-[#3e4658]">
              Name any topic and nipsol works it out in front of you — hand-drawn boards,
              narrated as they are drawn, branching as deep as you care to follow. We are
              raising to make it faster, sharper and wider, and we would rather talk early
              than pitch late.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={mailto('investment')}
                className="flex h-12 items-center rounded-[14px] bg-gradient-to-b from-[#2f70ee] to-[#2363df] px-5 text-[16px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15)] transition hover:brightness-[1.06]"
              >
                Talk to us
              </a>
              <Link
                href="/login?next=/mindmap"
                className="flex h-12 items-center rounded-[14px] border border-[#d7dbe6] bg-white px-5 text-[16px] font-semibold text-[#22304a] transition hover:border-[#b9c2d4]"
              >
                See it work
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-[26px] border border-zinc-900/[0.06] bg-[#fbfcfe]">
            <BoardDemo />
          </div>
        </div>
      </section>

      <Founder heading="Who you would be backing" />

      {/* The pitch on the left, the card on the right, exactly as an investor
          expects to read it: reasons first, terms always in view. */}
      <section className="mx-auto mt-10 grid w-full max-w-6xl gap-10 px-6 pb-24 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="text-[30px] font-semibold tracking-tight text-zinc-900">
            Reasons to invest
          </h2>

          <ul className="mt-7 flex flex-col">
            {REASONS.map((reason, i) => (
              <li
                key={reason.title}
                className={`flex gap-4 ${i ? 'mt-6 border-t border-dashed border-zinc-200 pt-6' : ''}`}
              >
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-zinc-900 text-white">
                  <svg viewBox="0 0 20 20" className="size-3.5" fill="none" aria-hidden>
                    <path
                      d="M5 10.5l3.2 3.2L15 7"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div>
                  <h3 className="text-[17px] font-semibold text-zinc-900">{reason.title}</h3>
                  <p className="mt-1.5 text-[15.5px] leading-relaxed text-[#3e4658]">
                    {reason.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-12">
            <span className="inline-flex h-7 items-center rounded-full bg-[#2f70ee] px-3 text-[12px] font-semibold text-white">
              The pitch
            </span>
            <h2 className="mt-5 text-[30px] font-semibold tracking-tight text-zinc-900">
              Explaining is the last thing software never learned to do
            </h2>
            <div className="mt-4 flex flex-col gap-4 text-[16px] leading-relaxed text-[#3e4658]">
              <p>
                Search gives you documents. Chat gives you paragraphs. Neither does the thing
                a good teacher does at a whiteboard: decide what to draw first, put it where
                your eye will find it, and say the sentence that makes the picture mean
                something. That was impossible to automate until very recently. It is not
                impossible now, and almost nobody is building it.
              </p>
              <p>
                nipsol writes the lesson, lays the board out, draws it and narrates it in
                time with the drawing. Every branch of a mindmap opens into another one, as
                far down as you follow it. The maths tutor works a problem a line at a time
                in real notation, saying it the way a person would read it aloud.
              </p>
              <p>
                We are early and we say so everywhere — in the product, on the pricing page,
                and here. What exists works. What we want the money for is speed: more
                subjects, better boards, and getting it in front of the people who need it
                most.
              </p>
            </div>
          </div>

          <div className="mt-12 rounded-[26px] border border-zinc-200 bg-white p-7">
            <h3 className="text-[19px] font-semibold tracking-tight text-zinc-900">
              What we are honest about
            </h3>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[15.5px] leading-relaxed text-[#3e4658]">
              <li>We are in beta. Paid plans are not open yet.</li>
              <li>
                There are no revenue or user numbers on this page because there are none
                worth quoting. When there are, they will be here.
              </li>
              <li>
                The fastest way to judge this is to use it for ten minutes, which costs you
                nothing and tells you more than a deck.
              </li>
            </ul>
          </div>
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start">
          <RaiseCard facts={FACTS} />

          <div className="mt-4 rounded-[22px] border border-zinc-200 bg-white p-5">
            <h3 className="text-[15px] font-semibold text-zinc-900">Prefer to look first?</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-[#3e4658]">
              Make a lesson on any topic you already know well. That is the honest test.
            </p>
            <Link
              href="/login?next=/mindmap"
              className="mt-3 flex h-11 items-center justify-center rounded-xl border border-[#d7dbe6] text-[14.5px] font-semibold text-[#22304a] transition hover:border-[#b9c2d4]"
            >
              Open nipsol
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
