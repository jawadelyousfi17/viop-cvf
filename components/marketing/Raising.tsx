'use client'

import { mailto } from '@/lib/contact'
import { Dialog } from '../ui/Dialog'

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

/**
 * The ask, once, just after someone's first lesson has finished.
 *
 * Timing is the whole point: this is the moment the product has just proved
 * itself to them, and it is the only moment where "we are raising to build
 * more of this" lands as a natural thing to say rather than an interruption.
 * Shown once ever — a second showing is an advert, and this is not one.
 *
 */
export function RaisingDialog({
  open,
  onClose,
}: {
  /**
   * What prompted it, or null for closed.
   *
   *   'first-lesson'  they have just watched their first one work
   *   'limit'         the free plan is spent
   *
   * Two different moments and two different sentences. The second one owes
   * them an explanation first — they have just been stopped — and the ask only
   * makes sense after it.
   */
  open: 'first-lesson' | 'limit' | null
  onClose: () => void
}) {
  const limit = open === 'limit'

  return (
    // Narrower than the dialog's own 44rem: this is a paragraph and a button,
    // and a paragraph set across seven hundred pixels is one nobody finishes.
    <Dialog
      open={open !== null}
      onClose={onClose}
      label="nipsol is raising"
      className="!w-[min(100%-1.5rem,30rem)]"
    >
      <div className="p-7 text-center">
        <span className="inline-flex h-[22px] items-center rounded-full bg-[#e3edff] px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#2f70ee]">
          {limit ? "That's the free plan" : 'Raising now'}
        </span>

        <h2 className="mt-4 text-[23px] font-semibold leading-snug tracking-tight text-zinc-900">
          {limit
            ? "You've used everything the free plan includes."
            : "That was your first lesson. We're raising to build a lot more of them."}
        </h2>

        <p className="mt-3 text-[15px] leading-relaxed text-[#41506b]">
          {limit
            ? "Paid plans aren't open yet — we're in beta, and we're raising a round to get there. Everything you have made is still here and still yours. If you invest, or know someone who does, that is the fastest way to see the rest of this built."
            : 'nipsol is early — a teacher that draws, explains and keeps going as deep as you follow it. We are raising a round to make it faster, sharper and wider, and we are talking to investors now. If you invest, or know someone who does, we would like to hear from you.'}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <a
            href={mailto('investment')}
            onClick={onClose}
            className="flex h-12 items-center justify-center rounded-[14px] bg-gradient-to-b from-[#2f70ee] to-[#2363df] text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15)] transition hover:brightness-[1.06]"
          >
            Talk to us about investing
          </a>
          <button
            type="button"
            onClick={onClose}
            className="h-10 text-[14px] font-medium text-zinc-500 transition hover:text-zinc-800"
          >
            {limit ? 'Back to my work' : 'Back to my lesson'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
