'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { startCheckout } from '@/app/actions/checkout'
import { canBuy, type BillingCycle } from '@/lib/plans'

/**
 * The button that leaves for Whop.
 *
 * It knows a cycle and nothing else — no plan id, no price, no key. The server
 * action resolves what that actually buys, which is what keeps the ids off the
 * client and means a forged call can only ever start a checkout for something
 * already on sale at the published price.
 *
 * While checkout is closed the button stays, disabled, saying so. A price with
 * no way to pay it is honest; a button that goes nowhere is not.
 */
export function CheckoutButton({
  cycle,
  label,
  className,
}: {
  cycle: BillingCycle
  label: string
  className: string
}) {
  const router = useRouter()
  const [pending, begin] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!canBuy(cycle)) {
    return (
      <span className={`${className} cursor-not-allowed opacity-60`} aria-disabled>
        Coming soon
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          begin(async () => {
            setError(null)
            const result = await startCheckout(cycle)

            if (result.ok) {
              // A different origin, so a full navigation rather than a route
              // push — this is leaving the site.
              window.location.href = result.url
              return
            }
            if (result.signIn) {
              router.push(result.signIn)
              return
            }
            setError(result.error)
          })
        }
      >
        {pending ? 'One moment…' : label}
      </button>
      {error && (
        <p className="absolute inset-x-6 -bottom-7 text-center text-[13px] text-red-600">
          {error}
        </p>
      )}
    </>
  )
}
