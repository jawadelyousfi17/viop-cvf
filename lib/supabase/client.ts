'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase in the browser.
 *
 * One instance for the tab: each client opens its own auth listener and token
 * refresh timer, and a component that made a fresh one per render would leave a
 * trail of both behind it.
 */
let client: ReturnType<typeof createBrowserClient> | null = null

export function supabaseBrowser() {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''
  )
  return client
}
