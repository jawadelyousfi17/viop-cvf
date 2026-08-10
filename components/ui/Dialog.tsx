'use client'

import { useEffect, useRef } from 'react'
import { IconClose } from '../mindmap/icons'

/**
 * A modal, built on the browser's own `<dialog>`.
 *
 * Everything hard about a modal is already implemented in the platform:
 * focus is trapped inside it, the rest of the page goes inert, Escape closes
 * it, and it renders in the top layer so no ancestor's `overflow: hidden` or
 * z-index can clip it. A div with `position: fixed` gets none of that, and the
 * hand-rolled versions of it are where keyboard users end up tabbing around
 * behind the overlay.
 *
 * The one thing the element does not do is stay in step with React state, so
 * `open` drives `showModal`/`close` and every native way out — Escape, the
 * backdrop — is routed back through `onClose`.
 */
export function Dialog({
  open,
  onClose,
  label,
  children,
  full = false,
  className = '',
}: {
  open: boolean
  onClose: () => void
  /** The accessible name. Announced when the dialog takes focus. */
  label: string
  children: React.ReactNode
  /**
   * Fill the window rather than sit in the middle of it.
   *
   * For the things that are a screen in their own right — pricing is one — a
   * card floating over a dimmed board asks to be dismissed. Filling the window
   * says this is what you are looking at now.
   */
  full?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  // `showModal` makes the page inert but not unscrollable, so a trackpad still
  // slides the board around behind the pricing.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={label}
      // Escape and any other native close. Without this the element hides
      // itself and React still believes it is open, so the next click on the
      // trigger does nothing at all.
      onClose={onClose}
      // The backdrop is not a child, so a click on it lands on the dialog
      // itself — which is how you tell "outside" from "inside" here.
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className={`bg-transparent p-0 text-zinc-900 backdrop:bg-zinc-900/50 backdrop:backdrop-blur-sm ${
        full
          ? 'm-0 h-dvh max-h-none w-screen max-w-none'
          : 'm-auto w-[min(100%-1.5rem,44rem)] rounded-3xl'
      } ${className}`}
    >
      {/* Inside the backdrop-click test above: anything in here is "inside". */}
      <div
        className={`relative border-black/5 bg-white ${
          full
            ? 'h-full overflow-y-auto'
            : 'overflow-hidden rounded-3xl border shadow-2xl shadow-black/20'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
        >
          <IconClose className="size-4" />
        </button>
        {children}
      </div>
    </dialog>
  )
}
