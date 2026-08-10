'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { supabaseBrowser } from '@/lib/supabase/client'
import { GoogleButton } from '../auth/GoogleButton'

/**
 * Who is signed in, at the foot of the sidebar.
 *
 * Behind the wall this is normally just a name and a way out — nobody reaches
 * this screen signed out. It still handles the signed-out case because a
 * session can expire in an open tab, and a dead app with no explanation is
 * worse than one that says what to do about it.
 */
export function AuthPanel({ onChange }: { onChange?: () => void }) {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const router = useRouter()

  const [who, setWho] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!configured) return
    const supabase = supabaseBrowser()

    // Annotated because the client is generic over a database schema this app
    // does not declare — without a schema type the inference lands on `any`.
    void supabase.auth
      .getUser()
      .then(({ data }: { data: { user: User | null } }) => setWho(data.user?.email ?? null))

    // Fires on sign-in, sign-out and token refresh — the moment ownership of
    // the history changes, whoever is showing it needs to re-read it.
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setWho(session?.user?.email ?? null)
        onChange?.()
      }
    )
    return () => sub.subscription.unsubscribe()
  }, [configured, onChange])

  const signOut = useCallback(async () => {
    setBusy(true)
    await supabaseBrowser().auth.signOut()
    // The page is walled, so there is nothing here for a signed-out visitor to
    // look at — send them to the door rather than leaving them on a screen the
    // next request would bounce them off anyway.
    router.replace('/login?next=/lessons')
    router.refresh()
  }, [router])

  if (!configured) return null

  if (!who) {
    return <GoogleButton next="/mindmap" label="Sign in with Google" />
  }

  // The name is the way to the account page. A profile nothing links to is a
  // page that exists and is never seen, and the foot of the rail is where
  // people already look to find out who they are signed in as.
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <Link
        href="/profile"
        className="min-w-0 flex-1 truncate rounded-lg px-2 py-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
        title="Your account"
      >
        {who}
      </Link>
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={busy}
        className="shrink-0 rounded-lg px-2 py-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
      >
        Sign out
      </button>
    </div>
  )
}
