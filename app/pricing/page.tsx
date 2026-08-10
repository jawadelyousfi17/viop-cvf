import { Logo } from '@/components/ui/Logo'
import type { Metadata } from 'next'
import { Plans, PlansBackdrop } from '@/components/marketing/Plans'

export const metadata: Metadata = {
  title: 'Pricing — nipsol',
  description: '$30 a month, or $299 a year. One plan, everything in it.',
}

export default function PricingPage() {
  return (
    <PlansBackdrop>
      <main className="min-h-dvh px-6 py-16">
      <div className="mx-auto w-full max-w-[980px]">
        <Logo height={30} />
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-900">
          One plan. All of it.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-zinc-500">
          There is one product here and everybody gets the whole thing. The only decision is
          how long you are committing for.
        </p>

        <div className="mt-14">
          <Plans />
        </div>
      </div>
      </main>
    </PlansBackdrop>
  )
}
