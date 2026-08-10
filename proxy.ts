import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * The login wall, and the thing that keeps a session alive behind it.
 *
 * One gate for the whole app rather than a check per route. Per-route checks
 * are how /studio stayed open after /mindmap was walled: the wall is only ever
 * as complete as someone's memory of every route, and new routes arrive
 * unguarded by default. Here the default is the other way round — everything
 * is behind it, and the handful of public pages are listed.
 *
 * It also refreshes the session on every request. An access token lasts an
 * hour; without that, someone signed in who comes back after lunch gets thrown
 * out to /login by this very file.
 *
 * Called `proxy` and not `middleware`: that convention is deprecated in Next 16
 * and renamed, and this is the same thing under its new name.
 */

/** Pages anyone may see: the pitch, the price, and the way in. */
const PUBLIC = [
  '/',
  '/login',
  '/pricing',
  '/fundraising',
  '/terms',
  '/privacy',
  '/contact',
  '/auth',
]

/**
 * Routes the public pages themselves depend on.
 *
 * The landing page draws a real map, and a real map has symbols. The route
 * keeps its own allowlist of which terms may be drawn without an account — see
 * app/api/icon/route.ts — so opening it here does not open a model endpoint.
 *
 * The Whop webhook is here for a different reason: nobody is signed in when a
 * payment provider posts to you. It authenticates itself with a signature over
 * the raw body instead, which is stronger than a session would be.
 */
const PUBLIC_API = ['/api/icon', '/api/whop/webhook']

function isPublic(pathname: string) {
  if (PUBLIC_API.includes(pathname)) return true
  return PUBLIC.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  // A deployment with no auth configured is not walled — there would be no way
  // through it, and the app would simply be dead.
  if (!url || !key) return NextResponse.next({ request })

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (written) => {
        // Written to the request as well, so anything rendering later in this
        // same pass reads the refreshed session rather than the stale one.
        for (const { name, value } of written) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of written) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Validated against Supabase rather than trusted from the cookie, and the
  // call doubles as the token refresh — `setAll` above puts the result on the
  // response.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl
  if (user || isPublic(pathname)) return response

  // An API answers; a page redirects. A 401 tells a fetch what happened, where
  // a redirect would hand it a login page as JSON and confuse the caller.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  }

  const login = new URL('/login', request.url)
  login.searchParams.set('next', pathname + search)
  return NextResponse.redirect(login)
}

export const config = {
  // Everything except static assets and the image optimiser — walling a
  // favicon buys nothing and costs a round trip to Supabase.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
