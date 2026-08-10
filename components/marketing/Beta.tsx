import Link from 'next/link'
import { mailto } from '@/lib/contact'
import { BetaBadge } from '@/components/ui/BetaBadge'

/**
 * Where the product actually is, said plainly.
 *
 * Two things are true at once and both are worth saying out loud: this is new
 * enough that things will change under you, and we are raising. Burying either
 * is the kind of omission people find out about later and hold against you —
 * and saying them costs nothing, because the sort of person who tries a
 * three-week-old tool is the sort who is *interested* that it is three weeks
 * old.
 *
 * No metrics, no round size, no logos. Everything here is something we can
 * stand behind on a bad day.
 */


export function Beta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24">
      <div className="grid gap-12 rounded-[34px] border border-zinc-900/[0.08] bg-white p-9 shadow-[0_12px_30px_rgba(71,96,145,.10)] sm:grid-cols-2 sm:p-12">
        <div>
          <BetaBadge className="!h-7 !px-3 !text-[12px]" />
          <h2 className="mt-5 text-[26px] font-semibold tracking-tight text-zinc-900">
            Early, and honest about it.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-[#3e4658]">
            nipsol works — the maps, the lessons and the tutor are all real and all yours to
            keep. It is also new: boards change as we improve them, and the prices are not
            carved anywhere yet. Nothing you make is thrown away when something changes.
          </p>
          <p className="mt-4 text-[16px] leading-relaxed text-[#3e4658]">
            If something breaks, or draws the wrong thing, or explains it badly — tell us. At
            this size a message actually changes the product.
          </p>
          <a
            href={mailto('feedback')}
            className="mt-6 inline-flex h-12 items-center rounded-[14px] border border-[#d7dbe6] bg-white px-5 text-[16px] font-semibold text-[#22304a] transition hover:border-[#b9c2d4]"
          >
            Tell us what broke
          </a>
        </div>

        <div className="sm:border-l sm:border-zinc-100 sm:pl-12">
          <span className="inline-flex h-7 items-center rounded-full border border-[#bfe3cd] bg-[#f2fdf6] px-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0f8a4a]">
            Raising
          </span>
          <h2 className="mt-5 text-[26px] font-semibold tracking-tight text-zinc-900">
            We are raising, and talking to people.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-[#3e4658]">
            We are raising a round to keep building this — a teacher that draws, explains and
            keeps going as far down as you want to follow it. If you invest in things at this
            stage, we would rather talk early than pitch late.
          </p>
          <p className="mt-4 text-[16px] leading-relaxed text-[#3e4658]">
            The fastest way to understand it is to use it: make a map, open a branch, and see
            how far it goes.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={mailto('investment')}
              className="inline-flex h-12 items-center rounded-[14px] bg-gradient-to-b from-[#2f70ee] to-[#2363df] px-5 text-[16px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15)] transition hover:brightness-[1.06]"
            >
              Get in touch
            </a>
            <Link
              href="/login?next=/mindmap"
              className="inline-flex h-12 items-center rounded-[14px] border border-[#d7dbe6] bg-white px-5 text-[16px] font-semibold text-[#22304a] transition hover:border-[#b9c2d4]"
            >
              Try it first
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
