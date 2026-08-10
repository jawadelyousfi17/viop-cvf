'use client'

import { useCallback, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

/**
 * The only way in.
 *
 * One provider rather than a wall of them plus a password field: every extra
 * option is a decision asked of someone who has not seen the product yet, and
 * passwords bring resets, leaks and a support burden that a two-person SaaS
 * does not want to own.
 *
 * The redirect goes to /auth/callback, which exchanges the code for a session —
 * that address has to be on Supabase's allowed redirect list.
 */
export function GoogleButton({
  next = '/mindmap',
  label = 'Continue with Google',
  className,
}: {
  next?: string
  label?: string
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const go = useCallback(async () => {
    setBusy(true)
    setNote(null)

    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })

    // Success navigates away, so anything reaching here is a failure worth
    // showing — most often Google not being enabled on the Supabase project.
    if (error) {
      setBusy(false)
      setNote(error.message)
    }
  }, [next])

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void go()}
        disabled={busy}
        className={
          className ??
          'flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-6 py-3.5 text-[15px] font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-50'
        }
      >
        <GoogleMark />
        {busy ? 'Taking you to Google…' : label}
      </button>
      {note && <p className="text-sm text-red-600">{note}</p>}
    </div>
  )
}

/** Google's own mark, drawn rather than fetched — no external request. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden className="size-[18px] shrink-0">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}
