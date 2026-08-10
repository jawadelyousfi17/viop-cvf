import type { Identity } from './owner'

/**
 * The account whose work everybody can look at.
 *
 * While generation is paused there is nothing for a new visitor to do: they
 * type a topic, get told the credits have run out, and leave without ever
 * seeing what the thing makes. The way out is to show them work that already
 * exists — so one account's maps, lessons and worked solutions are readable by
 * anyone, as the demos the empty state points at.
 *
 * A user id rather than an email, because that is what the rows carry. There
 * is no service key on this deployment, so an email cannot be resolved to an
 * id at request time — which is why the id is written here rather than looked
 * up. It identifies an account and authorises nothing: every request is still
 * checked against the caller's own session, and this only ever widens what may
 * be READ.
 *
 * The default is jawad.pro17@gmail.com, established as the only account in the
 * database holding any work. The environment overrides it, and setting it to
 * an empty string turns sharing off entirely.
 */
export const DEMO_OWNER_ID =
  process.env.DEMO_OWNER_ID?.trim() ?? '2d88ca65-0098-470e-aafa-f58fe5fac27c'

/**
 * A Prisma `where` for "mine, or the demo account's".
 *
 * Reading only. Every write — renaming, deleting, growing a map — keeps using
 * `owned()`, so a demo can be opened and watched by anyone and changed by
 * nobody but the account that made it.
 */
export function visible({ ownerKey, userId }: Identity) {
  const mine = userId ? { userId } : { ownerKey, userId: null }
  if (!DEMO_OWNER_ID || userId === DEMO_OWNER_ID) return mine
  return { OR: [mine, { userId: DEMO_OWNER_ID }] }
}

/**
 * Whether a row belongs to the demo account rather than to whoever is asking.
 *
 * The viewer is part of the question. Without it the demo account sees its own
 * work labelled as somebody's demo — true of the row and nonsense to the person
 * who made it, whose whole history would carry a badge saying it was not theirs.
 */
export const isDemo = (row: { userId: string | null }, viewer: Identity) =>
  Boolean(DEMO_OWNER_ID) && row.userId === DEMO_OWNER_ID && viewer.userId !== DEMO_OWNER_ID
