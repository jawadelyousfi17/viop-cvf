'use client'

import { Dialog } from '../ui/Dialog'
import { PAUSED_BADGE, PAUSED_BODY, PAUSED_POINTER, PAUSED_TITLE } from '@/lib/credits'

/**
 * Why nothing happened when they pressed Enter.
 *
 * The alternative was a disabled box or a spinner that never resolves, and
 * both make it look broken rather than paused — someone types a topic, gets
 * nothing, and concludes the product does not work. Saying it outright costs
 * one dialog and keeps the failure ours rather than theirs.
 *
 * It ends by pointing at the lessons already in the rail. There is a working
 * version of the thing they came for sitting three inches away, and an outage
 * notice that does not mention it wastes the one thing that still works.
 */
export function CreditsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} label={PAUSED_TITLE}>
      <div className="px-8 py-9">
        <span className="inline-flex h-[24px] items-center rounded-full border border-[#f0d9a8] bg-[#fdf8ee] px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#9a6a11]">
          Paused
        </span>

        <h2 className="mt-4 text-[24px] font-semibold tracking-tight text-zinc-900">
          {PAUSED_TITLE}
        </h2>
        <p className="mt-3 text-[16px] leading-relaxed text-[#3e4658]">{PAUSED_BODY}</p>
        <p className="mt-3 text-[16px] leading-relaxed text-[#3e4658]">{PAUSED_POINTER}</p>

        <button
          type="button"
          onClick={onClose}
          className="mt-7 flex h-[52px] w-full items-center justify-center rounded-[16px] bg-gradient-to-b from-[#2f70ee] to-[#2363df] text-[17px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15)] transition hover:brightness-[1.06]"
        >
          Show me the lessons
        </button>
      </div>
    </Dialog>
  )
}

/** The same fact, worn in the top bar so it is known before Enter is pressed. */
export function CreditsBadge({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={PAUSED_TITLE}
      className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-[#f0d9a8] bg-[#fdf8ee] px-3.5 text-[12.5px] font-medium text-[#9a6a11] transition hover:border-[#e3c88a]"
    >
      <span className="size-1.5 shrink-0 rounded-full bg-[#d9a441]" />
      {PAUSED_BADGE}
    </button>
  )
}
