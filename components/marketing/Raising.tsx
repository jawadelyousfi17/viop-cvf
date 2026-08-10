import { mailto } from '@/lib/contact'

/**
 * That we are raising, said plainly and where it will actually be read.
 *
 * The first version of this was a quiet grey note, and a quiet note about
 * money is one nobody acts on: it reads as a status line rather than an ask.
 * If the point is to find investors, the thing has to say what it wants —
 * that we are raising, that we are talking to people now, and that this
 * button is how you start that conversation.
 *
 * It sits where Upgrade used to. That button opens cards that all say "Coming
 * soon" at the moment, which is a dead end dressed up as an action; this one
 * asks for the thing we actually want.
 */

/** In the sidebar, above the account. Filled, because it is an ask. */
export function Raising() {
  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#2f70ee] to-[#2363df] p-3.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18)]">
      <span className="inline-flex h-[19px] items-center rounded-full bg-white/20 px-2 text-[9.5px] font-bold uppercase tracking-[0.12em]">
        Raising now
      </span>

      <p className="mt-2 text-[13px] font-semibold leading-snug">
        We&rsquo;re raising a round to build nipsol out.
      </p>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/80">
        Early, growing, and talking to investors this month. If you invest — or know
        someone who does — we&rsquo;d like to hear from you.
      </p>

      <a
        href={mailto('investment')}
        className="mt-2.5 flex h-8 items-center justify-center rounded-lg bg-white text-[11.5px] font-semibold text-[#2363df] transition hover:bg-white/90"
      >
        Talk to us about investing
      </a>
    </div>
  )
}

/** In the header, where Upgrade used to be. Says the word, not just the mood. */
export function RaisingChip({ className = '' }: { className?: string }) {
  return (
    <a
      href={mailto('investment')}
      title="nipsol is raising — talk to us about investing"
      className={
        className ||
        'flex h-9 items-center gap-2 rounded-xl bg-gradient-to-b from-[#2f70ee] to-[#2363df] px-4 text-[12.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18)] transition hover:brightness-[1.06]'
      }
    >
      <span className="relative flex size-1.5">
        {/* A live dot: this is happening now, not a page about it. */}
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-70" />
        <span className="relative inline-flex size-1.5 rounded-full bg-white" />
      </span>
      We&rsquo;re raising — invest
    </a>
  )
}
