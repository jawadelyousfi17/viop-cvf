'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabaseBrowser } from '@/lib/supabase/client'
import { GoogleButton } from './GoogleButton'

/**
 * The sign-in panel.
 *
 * Google and nothing else. There is no password to reset, no confirmation
 * email to get stuck in a spam folder, and nothing for this app to store that
 * could leak — the account already exists and Google vouches for it.
 */
export function LoginForm({ next = '/lessons', error }: { next?: string; error?: string }) {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const [who, setWho] = useState<string | null>(null)

  useEffect(() => {
    if (!configured) return
    void supabaseBrowser()
      .auth.getUser()
      .then(({ data }: { data: { user: User | null } }) => setWho(data.user?.email ?? null))
  }, [configured])

  if (!configured) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
        Accounts are not configured on this deployment, so there is nothing to sign in to yet.
      </p>
    )
  }

  if (who) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600">
        Signed in as <span className="text-zinc-900">{who}</span>.
        <Link href={next} className="ml-2 underline">
          Carry on
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <GoogleButton next={next} label="Sign in with Google" />
      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
