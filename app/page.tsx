import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import type { Metadata } from 'next'
import { Beta } from '@/components/marketing/Beta'
import { BetaBadge } from '@/components/ui/BetaBadge'
import { BoardDemo } from '@/components/marketing/BoardDemo'
import { Plans, PlansBackdrop } from '@/components/marketing/Plans'
import { DemoMap } from '@/components/marketing/DemoMap'
import { IconBoard, IconMap, IconSigma } from '@/components/mindmap/icons'

export const metadata: Metadata = {
  title: 'nipsol — anything explained, drawn by hand',
  description:
    'Name a topic and have it mapped, taught at a whiteboard, or worked through step by step. Hand-drawn boards, as deep as you want to go.',
}

/**
 * The landing page.
 *
 * One claim, pictures of the claim, one price.
 *
 * The app does three things — it maps a topic, it teaches one at a whiteboard,
 * and it works a problem through — and the page used to sell only the first.
 * Someone arriving for a tutor read a mindmap pitch and left. So the headline
 * covers all three, the modes are named before anything is scrolled past, and
 * the two demos below are the map and the lesson doing their actual work.
 *
 * The pictures are drawn by the real renderers, not screenshots. This page once
 * made its claim in three paragraphs and showed nothing, which is the one thing
 * a page selling a *drawing* tool cannot do.
 */
export default function Landing() {
  return (
    <main className="min-h-dvh bg-[#f7f9fd]">
      {/* The hero shares the pricing section's wash, so the page reads as one
          surface rather than a grey top bolted to a blue bottom. */}
      <PlansBackdrop>
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          {/* Above the fold, so it is fetched with the page rather than lazily
              — the logo arriving late is the one image people notice. */}
          <span className="flex items-center gap-2.5">
            <Logo height={30} href={null} priority />
            {/* Said at the top rather than only at the bottom: someone who
                bounces after four seconds should still know what this is. */}
            <BetaBadge />
          </span>
          <nav className="flex items-center gap-1.5 text-sm">
            <Link
              href="#pricing"
              className="rounded-lg px-3 py-1.5 text-zinc-500 transition hover:text-zinc-900"
            >
              Pricing
            </Link>
            <Link
              href="/mindmap"
              className="rounded-lg px-3 py-1.5 text-zinc-500 transition hover:text-zinc-900"
            >
              The app
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-zinc-900/10 bg-white/80 px-3.5 py-1.5 text-zinc-600 shadow-sm backdrop-blur transition hover:text-zinc-900"
            >
              Sign in
            </Link>
          </nav>
        </header>

        <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-8 sm:pt-14">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-semibold leading-[1.04] tracking-tight text-zinc-900 sm:text-[64px]">
              Anything explained, drawn by hand.
            </h1>
            <p className="mt-6 max-w-2xl text-[19px] leading-relaxed text-[#3e4658]">
              Name a topic and have it <strong className="font-semibold text-zinc-900">mapped</strong>,{' '}
              <strong className="font-semibold text-zinc-900">taught at a whiteboard</strong>, or{' '}
              <strong className="font-semibold text-zinc-900">worked through</strong> a step at a
              time. Everything is drawn as it is explained, and nothing stops at the label:
              click any edge of a map and that part opens up too. There is no bottom — it keeps
              going as long as you keep asking.
            </p>

            {/* Free first. It is the thing most people should do, and burying it
                behind "See pricing" asked them to price a product they had not
                used yet. */}
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/login?next=/mindmap"
                className="flex h-[58px] items-center justify-center rounded-[18px] bg-gradient-to-b from-[#2f70ee] to-[#2363df] px-8 text-[19px] font-semibold text-white shadow-[0_8px_20px_rgba(43,99,223,.28),inset_0_1px_0_rgba(255,255,255,.15)] transition hover:brightness-[1.06]"
              >
                Get started for free
              </Link>
              <Link
                href="#pricing"
                className="flex h-[58px] items-center justify-center rounded-[18px] border-[1.5px] border-[#c9d6ea] bg-white px-7 text-[19px] font-semibold text-[#21262f] shadow-[0_2px_5px_rgba(79,119,171,.10)] transition hover:border-[#a9bfdd]"
              >
                See pricing
              </Link>
            </div>
            <p className="mt-3.5 text-[15px] text-[#63708a]">
              Sign in with Google. No card until you decide to keep it.
            </p>
          </div>

          {/* The demonstration. Sized so the map is legible on a laptop without
              pushing the pricing off the bottom of the world. */}
          <div className="mt-14 overflow-hidden rounded-[28px] border border-zinc-900/[0.08] bg-white shadow-[0_20px_50px_rgba(71,96,145,.18),0_2px_6px_rgba(46,62,93,.05)]">
            <div className="flex items-center gap-1.5 border-b border-zinc-900/[0.06] px-5 py-3.5">
              <span className="size-2.5 rounded-full bg-[#e6eaf2]" />
              <span className="size-2.5 rounded-full bg-[#e6eaf2]" />
              <span className="size-2.5 rounded-full bg-[#e6eaf2]" />
              <span className="ml-2 text-[13px] text-zinc-400">How a cache stays fast</span>
            </div>
            <DemoMap className="h-[420px] w-full sm:h-[520px]" />
          </div>
        </section>
      </PlansBackdrop>

      {/* What the app actually is, in three lines, before anything is scrolled
          past. The page led with the map and mentioned the lesson halfway down,
          which read as one product with a sideline — and left the tutor
          undiscovered entirely. They are three answers to the same question and
          they are named together. */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-20">
        <h2 className="text-[28px] font-semibold tracking-tight text-zinc-900">
          Three ways to be shown.
        </h2>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-[#3e4658]">
          Same box, same board, same hand. Which one you want depends on whether you are
          getting your bearings, being taught, or stuck on a particular problem.
        </p>

        <div className="mt-9 grid gap-5 sm:grid-cols-3">
          <Mode
            icon={<IconMap className="size-5" />}
            name="Mindmap"
            line="The shape of a subject: the central idea, what it really divides into, and the specifics under each. Click any end and it grows there."
          />
          <Mode
            icon={<IconBoard className="size-5" />}
            name="Lesson"
            line="A whiteboard that talks. It draws while it explains, each thing landing on the word that introduces it, and you can interrupt to ask."
          />
          <Mode
            icon={<IconSigma className="size-5" />}
            name="Math tutor"
            line="A problem worked through a step at a time, with the reasoning written out beside the working rather than an answer handed over."
          />
        </div>
      </section>

      {/* The lesson, doing its actual work. The map demo above shows the thing
          you steer; this shows the thing that talks. */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-16">
        <h2 className="text-[28px] font-semibold tracking-tight text-zinc-900">
          Or have it taught to you.
        </h2>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-[#3e4658]">
          The whiteboard draws while it explains, each thing appearing on the word that
          introduces it. Here it is drawing, with the narration written underneath.
        </p>

        <div className="mt-8 overflow-hidden rounded-[28px] border border-zinc-900/[0.08] bg-white shadow-[0_20px_50px_rgba(71,96,145,.18),0_2px_6px_rgba(46,62,93,.05)]">
          <div className="flex items-center gap-1.5 border-b border-zinc-900/[0.06] px-5 py-3.5">
            <span className="size-2.5 rounded-full bg-[#e6eaf2]" />
            <span className="size-2.5 rounded-full bg-[#e6eaf2]" />
            <span className="size-2.5 rounded-full bg-[#e6eaf2]" />
            <span className="ml-2 text-[13px] text-zinc-400">Why your CPU has a cache</span>
          </div>
          <BoardDemo className="h-[380px] w-full sm:h-[440px]" />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        {/* Four across on a wide screen, two on a laptop. Left at three it
            dealt one of them onto a row of its own. */}
        <dl className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[17px] font-semibold text-zinc-900">It goes down, not wide</dt>
            <dd className="mt-2.5 text-[16px] leading-relaxed text-[#3e4658]">
              A leaf is not the end of the map — it is the part nobody has asked about yet.
              Click it and its own branches get written, where it stands.
            </dd>
          </div>
          <div>
            <dt className="text-[17px] font-semibold text-zinc-900">It explains at the edges</dt>
            <dd className="mt-2.5 text-[16px] leading-relaxed text-[#3e4658]">
              Four levels down you have stopped scanning a structure and started reading about
              one thing. So that is where the sentences are, not on the labels near the middle.
            </dd>
          </div>
          <div>
            <dt className="text-[17px] font-semibold text-zinc-900">It waits for you</dt>
            <dd className="mt-2.5 text-[16px] leading-relaxed text-[#3e4658]">
              A lesson holds on a full board long enough to read it, and stops when you type a
              question — answered on its own board, then back to where you were.
            </dd>
          </div>
          <div>
            <dt className="text-[17px] font-semibold text-zinc-900">It looks drawn</dt>
            <dd className="mt-2.5 text-[16px] leading-relaxed text-[#3e4658]">
              Hand-drawn boards, one colour per limb, with a symbol sketched to order for each
              branch. A whiteboard someone worked at, not a chart.
            </dd>
          </div>
        </dl>
      </section>

      <PlansBackdrop>
        <section id="pricing" className="border-t border-zinc-900/[0.06] py-24">
          <div className="mx-auto w-full max-w-6xl px-6">
            <h2 className="text-center text-[38px] font-semibold tracking-tight text-zinc-900">
              One plan. All of it.
            </h2>
            <p className="mx-auto mt-3.5 max-w-xl text-center text-[17px] leading-relaxed text-[#3e4658]">
              There is one product here and everybody gets the whole thing. The only decision
              is how long you are committing for.
            </p>
            <div className="mt-14">
              <Plans />
            </div>
          </div>
        </section>
      </PlansBackdrop>

      <Beta />

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-10 text-sm text-zinc-400">
        <Logo height={22} href={null} className="opacity-60" />
        <nav className="flex gap-4">
          <Link href="/mindmap" className="transition hover:text-zinc-600">
            Mindmaps
          </Link>
          <Link href="/mindmap" className="transition hover:text-zinc-600">
            Whiteboard lessons
          </Link>
          <Link href="/mindmap" className="transition hover:text-zinc-600">
            Math tutor
          </Link>
          <Link href="/contact" className="transition hover:text-zinc-600">
            Contact
          </Link>
          <Link href="/terms" className="transition hover:text-zinc-600">
            Terms
          </Link>
          <Link href="/privacy" className="transition hover:text-zinc-600">
            Privacy
          </Link>
        </nav>
      </footer>
    </main>
  )
}

/** One of the three things the app does, said in a sentence. */
function Mode({
  icon,
  name,
  line,
}: {
  icon: React.ReactNode
  name: string
  line: string
}) {
  return (
    <div className="rounded-[22px] border border-zinc-900/[0.07] bg-white p-6 shadow-[0_2px_6px_rgba(46,62,93,.05)]">
      <span className="flex size-10 items-center justify-center rounded-xl bg-[#eef4ff] text-[#2363df]">
        {icon}
      </span>
      <h3 className="mt-4 text-[17px] font-semibold text-zinc-900">{name}</h3>
      <p className="mt-2 text-[15.5px] leading-relaxed text-[#3e4658]">{line}</p>
    </div>
  )
}
