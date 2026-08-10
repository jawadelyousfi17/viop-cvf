'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

/**
 * The two things you can do to an account here.
 *
 * Signing out is the whole of it for now. Deleting an account is listed but
 * not wired to a button, because a delete that half-works — the auth row gone
 * and the maps still sitting in Postgres — is worse than an address to write
 * to, and this app has no billing to cancel alongside it yet.
 */
export function ProfileActions() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const signOut = useCallback(async () => {
    setBusy(true)
    await supabaseBrowser().auth.signOut()
    router.replace('/login?next=/mindmap')
    router.refresh()
  }, [router])

  return (
    <div className="mt-4 flex flex-col gap-3">
      <Row
        title="Sign out"
        detail="Your maps stay where they are, on every machine you sign back in from."
      >
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={busy}
          className="h-9 shrink-0 rounded-xl border border-zinc-200 bg-white px-4 text-[13px] font-medium text-zinc-700 transition hover:text-zinc-900 disabled:opacity-50"
        >
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      </Row>

      <Row
        title="Delete everything"
        detail="Write to hello@nipsol.com and we will remove your account and every map on it."
      >
        <a
          href="mailto:hello@nipsol.com?subject=Delete%20my%20account"
          className="flex h-9 shrink-0 items-center rounded-xl border border-zinc-200 bg-white px-4 text-[13px] font-medium text-zinc-500 transition hover:text-zinc-900"
        >
          Email us
        </a>
      </Row>
    </div>
  )
}

function Row({
  title,
  detail,
  children,
}: {
  title: string
  detail: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-100 px-5 py-4">
      <div className="min-w-0">
        <p className="text-[15px] text-zinc-800">{title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-500">{detail}</p>
      </div>
      {children}
    </div>
  )
}
