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
 * id at request time; the id is configuration, and /profile prints it for the
 * account that needs it so it can be copied into the environment.
 *
 * Unset and nothing changes: every list is your own work, exactly as before.
 */
export const DEMO_OWNER_ID = process.env.DEMO_OWNER_ID?.trim() ?? ''

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

/** Whether a row belongs to the demo account rather than to whoever is asking. */
export const isDemo = (row: { userId: string | null }) =>
  Boolean(DEMO_OWNER_ID) && row.userId === DEMO_OWNER_ID
