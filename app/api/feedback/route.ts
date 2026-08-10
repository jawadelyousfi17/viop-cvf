import { db, dbConfigured } from '@/lib/db'
import { requireIdentity } from '@/lib/owner'
import { currentUser } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * What someone thought.
 *
 * Kept rather than emailed: a mailbox is where feedback goes to be read once
 * and lost, and the useful question a month from now is "did the faces move
 * after we changed the board", which needs rows.
 *
 * The words are optional and the face is not. Someone who has clicked a face
 * has already told you the main thing, and demanding a sentence on top of it
 * is how you get "asdf" instead of a seven.
 */
export async function POST(request: Request) {
  if (!dbConfigured()) return Response.json({ error: 'No database configured.' }, { status: 501 })

  const identity = await requireIdentity()
  if (!identity) return Response.json({ error: 'Sign in first.' }, { status: 401 })

  let body: { rating?: unknown; message?: unknown; from?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 7) {
    return Response.json({ error: 'Pick how it felt first.' }, { status: 400 })
  }

  const user = await currentUser()

  await db.feedback.create({
    data: {
      owner: identity.userId ?? identity.ownerKey,
      userId: identity.userId,
      email: user?.email ?? null,
      rating,
      // Trimmed to something a person could have typed. Anything longer is a
      // paste, and the interesting part of a paste is always near the top.
      message: typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : '',
      from: typeof body.from === 'string' ? body.from.slice(0, 40) : '',
    },
  })

  return Response.json({ ok: true })
}
