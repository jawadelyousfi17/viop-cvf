import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * Supabase, from the server side of a request.
 *
 * Sessions live in cookies rather than in memory, which is what lets a Route
 * Handler and a Server Component agree about who is signed in. The publishable
 * key is public by design — it is in the browser bundle either way — and every
 * row this app owns is filtered by user in our own queries rather than trusted
 * to the key.
 */
export async function supabaseServer() {
  const jar = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (written) => {
          try {
            for (const { name, value, options } of written) jar.set(name, value, options)
          } catch {
            // Server Components cannot set cookies. Refreshes still happen in
            // route handlers and middleware, so swallowing this is correct
            // rather than merely convenient.
          }
        },
      },
    }
  )
}

/** Whether auth is configured at all. Without it the app runs signed-out. */
export function authConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
}

/** The signed-in user, or null. Verified against Supabase, not read off a cookie. */
export async function currentUser() {
  if (!authConfigured()) return null

  const supabase = await supabaseServer()
  const { data, error } = await supabase.auth.getUser()
  return error ? null : data.user
}
