import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client'
import { ModelName } from './generated/prisma/internal/prismaNamespace'

/**
 * One Prisma client for the process.
 *
 * Kept on `globalThis` in development because every hot reload re-evaluates
 * this module, and a new client per reload means a new connection pool per
 * reload — which is how a dev server ends up unable to open any more
 * connections after twenty edits. Production evaluates it once and skips it.
 *
 * The connection goes through Neon's pooler (the `-pooler` host in
 * DATABASE_URL), which is what makes this survivable on serverless: each
 * instance opens a handful of connections to the pooler rather than to
 * Postgres itself.
 *
 * The cached instance is stamped with the models it was generated from. Adding
 * a table and running `prisma generate` leaves the *old* client sitting on the
 * global — the new code calls `db.lesson`, gets undefined, and every write
 * fails until someone thinks to restart the dev server. Comparing the stamp
 * catches that: a schema change simply replaces the client.
 */

const fingerprint = Object.keys(ModelName).sort().join(',')

const store = globalThis as unknown as { prisma?: PrismaClient; prismaModels?: string }

function connect() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set — see .env.example.')
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
}

function client(): PrismaClient {
  if (store.prisma && store.prismaModels === fingerprint) return store.prisma

  // Either nothing cached, or what is cached predates the current schema.
  void store.prisma?.$disconnect().catch(() => {})
  const fresh = connect()

  if (process.env.NODE_ENV !== 'production') {
    store.prisma = fresh
    store.prismaModels = fingerprint
  }
  return fresh
}

export const db: PrismaClient = client()

/** Whether a database is configured at all. Without one, history is skipped. */
export function dbConfigured() {
  return Boolean(process.env.DATABASE_URL)
}
