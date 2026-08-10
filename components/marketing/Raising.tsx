import { mailto } from '@/lib/contact'

/**
 * That we are raising, said inside the app rather than only on the pitch page.
 *
 * The people using this every day are the ones who know whether it is any
 * good, and some of them invest in things. Telling them where the product is
 * costs nothing and is the kind of thing people are pleased to have been told
 * early rather than to find out about later.
 *
 * It sits where the Upgrade button was. That button currently opens a set of
 * cards that all say "Coming soon", which is a dead end dressed up as an
 * action; this is at least true, and it asks for the one thing we actually
 * want right now.
 */

/** In the sidebar, above the account. Quiet, and read once. */
export function Raising() {
  return (
    <div className="rounded-xl border border-[#dbe6f5] bg-[#f4f8ff] px-3 py-2.5">
      <span className="inline-flex h-[18px] items-center rounded-full bg-[#e3edff] px-2 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#2f70ee]">
        Raising
      </span>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#41506b]">
        We are raising to make nipsol better — faster boards, deeper lessons, more of the
        subjects you keep asking for.
      </p>
      <a
        href={mailto('investment')}
        className="mt-1.5 inline-block text-[11.5px] font-semibold text-[#2f70ee] transition hover:text-[#1c50b8]"
      >
        Get in touch →
      </a>
    </div>
  )
}

/** In the header, where Upgrade used to be. One line, and the same link. */
export function RaisingChip({ className = '' }: { className?: string }) {
  return (
    <a
      href={mailto('investment')}
      title="We are raising to make nipsol better — get in touch"
      className={
        className ||
        'flex h-9 items-center gap-2 rounded-xl border border-[#dbe6f5] bg-[#f4f8ff] px-3.5 text-[12.5px] font-medium text-[#2f70ee] transition hover:border-[#b9c9e8]'
      }
    >
      <span className="size-1.5 rounded-full bg-[#2f70ee]" />
      We are raising
    </a>
  )
}
