import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Where Google sends people back to.
 *
 * OAuth hands back a one-time code, not a session. It has to be exchanged
 * server-side — that is what writes the session cookies, and it is why this is
 * a route handler rather than something the sign-in button could do on its own.
 *
 * Supabase must be told this address is allowed: Authentication → URL
 * Configuration → Redirect URLs, both http://localhost:3000/auth/callback and
 * the deployed one. Google's own OAuth client needs the Supabase callback
 * (https://<project>.supabase.co/auth/v1/callback), not this one.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const asked = url.searchParams.get('next')

  // Same-site paths only, so the round trip through Google cannot be used to
  // bounce someone off to another host afterwards.
  const next = asked && /^\/[\w\-/]*$/.test(asked) ? asked : '/mindmap'

  if (!code) {
    const why = url.searchParams.get('error_description') ?? 'Sign-in was cancelled.'
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(why)}`, url.origin))
  }

  const supabase = await supabaseServer()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
    )
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
