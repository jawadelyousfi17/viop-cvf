import Image from 'next/image'
import { CONTACT_EMAIL } from '@/lib/contact'

/**
 * Who is building this.
 *
 * On a raise page it is the section people actually read first — at pre-seed
 * there is no revenue to look at, so the honest thing being assessed is the
 * person. And on the landing page it does the other half of what the beta
 * badge does: this is one identifiable human, not a faceless company, which is
 * a reason to trust it and a reason to be forgiving of it.
 *
 * A real photograph and a real phone number, because both are the point. A
 * founder section with a stock illustration and a contact form says the
 * opposite of what it is trying to say.
 */

const WHATSAPP = '212651754580'
/** As a person would read it out. */
const WHATSAPP_SHOWN = '+212 651 754 580'

export function Founder({
  /** On the raise page this leads; on the landing page it supports. */
  heading = 'Who is building this',
}: {
  heading?: string
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="grid items-center gap-9 rounded-[34px] border border-zinc-900/[0.07] bg-white p-8 shadow-[0_12px_30px_rgba(71,96,145,.10)] sm:grid-cols-[minmax(0,240px)_1fr] sm:p-10">
        <div className="relative mx-auto aspect-[4/5] w-full max-w-[240px] overflow-hidden rounded-[26px] bg-zinc-100">
          <Image
            src="/me.png"
            alt="Jawad El Yousfi"
            fill
            sizes="240px"
            className="object-cover"
          />
        </div>

        <div>
          <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            {heading}
          </span>

          <h2 className="mt-3 text-[28px] font-semibold tracking-tight text-zinc-900">
            Jawad El Yousfi
          </h2>
          <p className="mt-1 text-[15px] text-zinc-500">
            Software engineer · 26 · Morocco
          </p>

          <div className="mt-4 flex flex-col gap-3 text-[16px] leading-relaxed text-[#3e4658]">
            <p>
              I studied computer science at <strong className="font-semibold text-zinc-900">1337</strong>{' '}
              — the UM6P school where you learn by building rather than by being lectured at,
              which is most of why I ended up making this. The thing I kept wanting was
              somebody at a whiteboard who would draw the idea instead of handing me another
              page to read.
            </p>
            <p>
              I build nipsol myself: the board engine, the lessons, the voice, the app. That
              means it moves quickly and that you are talking to the person who wrote the
              thing when you write in.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={`https://wa.me/${WHATSAPP}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center gap-2 rounded-[13px] bg-[#25D366] px-4 text-[15px] font-semibold text-white transition hover:brightness-[1.05]"
            >
              <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden>
                <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.53.07-.8.38-.28.3-1.05 1.02-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.12 3.24 5.14 4.54.72.31 1.28.5 1.71.63.72.23 1.37.2 1.89.12.58-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.37 9.37 0 0 1-1.44-5.01c0-5.18 4.23-9.4 9.42-9.4a9.36 9.36 0 0 1 9.41 9.41c0 5.18-4.22 9.41-9.42 9.41zM20.52 3.49A11.78 11.78 0 0 0 12.04 0C5.5 0 .18 5.32.18 11.86c0 2.09.55 4.13 1.59 5.93L.08 24l6.35-1.66a11.8 11.8 0 0 0 5.61 1.43h.01c6.53 0 11.85-5.32 11.85-11.86 0-3.17-1.23-6.15-3.38-8.42z" />
              </svg>
              {WHATSAPP_SHOWN}
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="flex h-11 items-center rounded-[13px] border border-[#d7dbe6] bg-white px-4 text-[15px] font-semibold text-[#22304a] transition hover:border-[#b9c2d4]"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
