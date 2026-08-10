import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { db } from './db'
import { authConfigured, currentUser } from './supabase/server'

/**
 * Who a saved map belongs to.
 *
 * The app is behind a login wall, so in practice that is the signed-in user and
 * `requireIdentity` is what every route calls. The browser cookie remains for
 * one reason: rows created before the wall went up are owned by a cookie and
 * nothing else, and `claim` hands them to the account the first time that same
 * browser signs in. Delete the cookie and you strand them.
 */

// Still the old product name, on purpose: the maps made before the login wall
// are owned by whatever this cookie says, and renaming it would orphan every
// one of them. It is invisible to anyone using the app.
const COOKIE = 'viop_owner'
const A_YEAR = 60 * 60 * 24 * 365

export interface Identity {
  ownerKey: string
  userId: string | null
}

/**
 * The caller's identity, minting a browser key if they have none.
 *
 * Only usable where a cookie can be set — a Route Handler or a Server Action.
 */
export async function identify(): Promise<Identity> {
  const jar = await cookies()
  const existing = jar.get(COOKIE)?.value
  let ownerKey = existing && /^[\w-]{8,64}$/.test(existing) ? existing : ''

  if (!ownerKey) {
    ownerKey = randomUUID()
    jar.set(COOKIE, ownerKey, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: A_YEAR,
      // Off on localhost, or the cookie is dropped and every request looks
      // like a new visitor.
      secure: process.env.NODE_ENV === 'production',
    })
  }

  const user = await currentUser()
  return { ownerKey, userId: user?.id ?? null }
}

/**
 * The caller, or null when nobody is signed in.
 *
 * The single gate every route that touches a map goes through. A redirect on
 * the page is not a wall — it only decides what gets rendered, and the API is
 * reachable without ever loading a page.
 */
export async function requireIdentity(): Promise<Identity | null> {
  if (!authConfigured()) return identify()

  const identity = await identify()
  return identity.userId ? identity : null
}

/**
 * Hands this browser's pre-wall maps to the account that just signed in.
 *
 * Idempotent and cheap — after the first call there is nothing left matching,
 * so it can run on any request rather than needing a sign-in hook.
 */
export async function claim({ ownerKey, userId }: Identity) {
  if (!userId) return
  await db.mindmap.updateMany({
    where: { ownerKey, userId: null },
    data: { userId },
  })
}

/**
 * The rows this identity may see.
 *
 * Signed in: everything of theirs, on any browser. Only a deployment with no
 * auth configured ever takes the second branch.
 */
export function owned({ ownerKey, userId }: Identity) {
  return userId ? { userId } : { ownerKey, userId: null }
}
