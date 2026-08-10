/**
 * The beta mark.
 *
 * Its own component because it now sits beside the logo in three places, and a
 * badge that says "Beta" in the header and "BETA" in the app is a badge nobody
 * trusts. When it comes off, it comes off here.
 */
export function BetaBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-[22px] shrink-0 items-center rounded-full border border-[#bcd7f4] bg-[#f5fbff] px-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#0864cf] ${className}`}
    >
      Beta
    </span>
  )
}
