import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'
import { Logo } from '@/components/ui/Logo'
import { BetaBadge } from '@/components/ui/BetaBadge'

export const metadata: Metadata = {
  title: 'Sign in — nipsol',
  description: 'Sign in to nipsol with Google.',
}

/**
 * The way in, and nothing else on the page.
 *
 * A name and a button. There is one provider, so there is no choice to explain,
 * and anything else here would be words standing between someone and the only
 * thing they came to do.
 *
 * `next` comes from whatever sent them here — the wall in proxy.ts sets it to
 * wherever they were headed.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const query = await searchParams
  const asked = query.next
  const failure = typeof query.error === 'string' ? query.error.slice(0, 200) : undefined

  // Only same-site paths are honoured, so this cannot be used to bounce someone
  // to another host after they sign in.
  const next = typeof asked === 'string' && /^\/[\w\-/]*$/.test(asked) ? asked : '/mindmap'

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-xs text-center">
        <h1 className="flex items-center justify-center gap-2.5">
          <Logo height={38} href={null} priority />
          <BetaBadge />
        </h1>

        <div className="mt-8">
          <LoginForm next={next} error={failure} />
        </div>
      </div>
    </main>
  )
}
