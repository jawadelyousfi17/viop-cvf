import Link from 'next/link'
import { Logo } from '../ui/Logo'

/**
 * The shell both legal pages sit in.
 *
 * Plain, narrow, and readable. A terms page set in six-point grey inside a
 * scroll box is a page written to be agreed to rather than read, and the whole
 * value of writing these honestly is lost if nobody can get through them.
 *
 * The date is passed in rather than generated: "last updated" has to mean the
 * day the words changed, not the day the page was rendered.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-dvh bg-[#f7f9fd]">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-6">
        <Logo height={26} href="/" />
        <nav className="flex gap-4 text-sm text-zinc-500">
          <Link href="/terms" className="transition hover:text-zinc-900">
            Terms
          </Link>
          <Link href="/privacy" className="transition hover:text-zinc-900">
            Privacy
          </Link>
          <Link href="/contact" className="transition hover:text-zinc-900">
            Contact
          </Link>
        </nav>
      </header>

      <article className="mx-auto w-full max-w-3xl px-6 pb-24 pt-6">
        <h1 className="text-[36px] font-semibold tracking-tight text-zinc-900">{title}</h1>
        <p className="mt-3 text-[15px] text-zinc-400">Last updated {updated}</p>

        <div className="mt-10 flex flex-col gap-8 text-[16px] leading-relaxed text-[#3e4658] [&_a]:underline [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-zinc-900 [&_li]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>

        <p className="mt-12 border-t border-zinc-200 pt-6 text-[14px] leading-relaxed text-zinc-400">
          nipsol is a small product in beta. These pages are written to be accurate about what
          the software actually does rather than to be exhaustive, and they are not legal
          advice — if you are relying on them for anything that matters, have a lawyer read
          them first.
        </p>
      </article>
    </main>
  )
}

/** A section, so both pages read the same way down the page. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2>{title}</h2>
      {children}
    </section>
  )
}
