import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { db, dbConfigured } from '@/lib/db'
import { owned, requireIdentity } from '@/lib/owner'
import { authConfigured, currentUser } from '@/lib/supabase/server'
import { ProfileActions } from '@/components/profile/ProfileActions'
import { UpgradeButton } from '@/components/marketing/UpgradeButton'

export const metadata: Metadata = {
  title: 'Your account — nipsol',
  description: 'Who you are signed in as, and what you have made.',
}

/**
 * The account page.
 *
 * A server component on purpose: who is signed in and what they have made are
 * both answers the server already has, and fetching them from the browser would
 * mean rendering an empty shell first and filling it in a moment later — a
 * page that flickers through "no maps" on its way to the truth.
 *
 * Deliberately not a settings screen. There is nothing to configure yet, and a
 * page of empty preference rows is a promise the product has not made.
 */
export default async function ProfilePage() {
  const identity = authConfigured() ? await requireIdentity() : null
  if (authConfigured() && !identity) redirect('/login?next=/profile')

  const stats = identity && dbConfigured() ? await summarise(identity) : null

  const user = identity ? await whoIs() : null

  return (
    <main className="min-h-dvh bg-[#f4f6f8] px-6 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <Logo height={28} href="/mindmap" />
          <UpgradeButton className="flex h-9 items-center rounded-xl bg-zinc-900 px-4 text-[12.5px] font-medium text-white transition hover:bg-zinc-700" />
        </div>

        {/* Who. The avatar comes back from Google as a URL on their CDN, so it
            is a plain <img>: routing it through next/image would mean adding a
            remote host to the config for one 40px picture. */}
        <section className="mt-6 rounded-[22px] border border-zinc-200 bg-white p-7 shadow-sm">
          <div className="flex items-center gap-4">
            {user?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar}
                alt=""
                width={56}
                height={56}
                className="size-14 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-lg font-medium text-white">
                {(user?.name ?? user?.email ?? '?').trim().charAt(0).toUpperCase()}
              </span>
            )}

            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-900">
                {user?.name || user?.email || 'Signed out'}
              </h1>
              {user?.name && user.email && (
                <p className="truncate text-[14px] text-zinc-500">{user.email}</p>
              )}
              {user?.since && (
                <p className="mt-0.5 text-[12.5px] text-zinc-400">
                  With us since {user.since}
                </p>
              )}
            </div>
          </div>

          {/* The plan. Stated plainly rather than dressed as a banner: there is
              one paid plan and the button for it is already at the top. */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-5 py-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
                Plan
              </p>
              <p className="mt-1 text-[15px] text-zinc-800">Free while we are in beta</p>
            </div>
            <Link
              href="/pricing"
              className="text-[13px] font-medium text-zinc-500 underline-offset-4 transition hover:text-zinc-900 hover:underline"
            >
              See what a plan includes
            </Link>
          </div>
        </section>

        {/* What they have made. Numbers only — the maps themselves are one
            click away in the rail, and listing them again here would be a
            worse copy of a list that already exists. */}
        {stats && (
          <section className="mt-4 grid gap-4 sm:grid-cols-3">
            <Stat label="Maps" value={stats.maps} />
            <Stat label="Branches drawn" value={stats.nodes} />
            <Stat label="Deepest map" value={stats.depth} suffix={stats.depth === 1 ? 'level' : 'levels'} />
          </section>
        )}

        <section className="mt-4 rounded-[22px] border border-zinc-200 bg-white p-7 shadow-sm">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
            Account
          </h2>
          <ProfileActions />
        </section>
      </div>
    </main>
  )
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-[22px] border border-zinc-200 bg-white px-6 py-5 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
        <span className="text-3xl font-semibold tracking-tight text-zinc-900">{value}</span>
        {suffix && <span className="text-[13px] text-zinc-500">{suffix}</span>}
      </p>
    </div>
  )
}

/** The signed-in user, reduced to what this page draws. */
async function whoIs() {
  const user = await currentUser()
  if (!user) return null

  const meta = user.user_metadata as { full_name?: string; name?: string; avatar_url?: string }
  return {
    email: user.email ?? '',
    name: meta.full_name ?? meta.name ?? '',
    avatar: meta.avatar_url ?? '',
    since: user.created_at
      ? new Date(user.created_at).toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        })
      : '',
  }
}

/**
 * How much has been made, in one query rather than by reading every tree.
 *
 * `nodeCount` and `depth` are already denormalised onto the row for the history
 * list, so the totals are an aggregate and not a parse of every map.
 */
async function summarise(identity: Awaited<ReturnType<typeof requireIdentity>>) {
  if (!identity) return null
  try {
    const [count, totals] = await Promise.all([
      db.mindmap.count({ where: owned(identity) }),
      db.mindmap.aggregate({
        where: owned(identity),
        _sum: { nodeCount: true },
        _max: { depth: true },
      }),
    ])
    return {
      maps: count,
      nodes: totals._sum.nodeCount ?? 0,
      depth: totals._max.depth ?? 0,
    }
  } catch (error) {
    // A profile that renders without its numbers beats one that 500s over them.
    console.error('[profile] could not count maps', error)
    return null
  }
}
