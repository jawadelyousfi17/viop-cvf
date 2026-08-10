'use client'

import { useState } from 'react'
import { Dialog } from '../ui/Dialog'
import { Plans, PlansBackdrop } from './Plans'

/**
 * Upgrade, without leaving what you were doing.
 *
 * It used to be a link to /pricing. Someone reading a map who wonders what this
 * costs does not want to be somewhere else — they want the number, and then to
 * carry on. A whole page navigation to answer that unloads the board, and
 * coming back is a second navigation and a re-fetch to land where they already
 * were.
 *
 * /pricing still exists and is still the page that gets linked to and indexed.
 * This is the same cards, full screen, so it reads as somewhere you went
 * rather than a card floating over the work.
 */
export function UpgradeButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          'flex h-[30px] items-center rounded-lg bg-zinc-900 px-3.5 text-[10.5px] font-medium text-white transition hover:bg-zinc-700'
        }
      >
        Upgrade
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} label="Pricing" full>
        <PlansBackdrop>
          <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
            <h2 className="text-center text-[34px] font-semibold tracking-tight text-zinc-900">
              One plan. All of it.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-[16px] leading-relaxed text-zinc-500">
              There is one product here and everybody gets the whole thing. The only decision
              is how long you are committing for.
            </p>
            <div className="mt-12 w-full">
              <Plans />
            </div>
          </div>
        </PlansBackdrop>
      </Dialog>
    </>
  )
}
