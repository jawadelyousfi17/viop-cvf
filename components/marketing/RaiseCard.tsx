'use client'

import { useState } from 'react'
import { CONTACT_EMAIL } from '@/lib/contact'

/**
 * The card that takes an amount and opens a conversation.
 *
 * Not a payment. There is no instrument to buy here and no money moves — this
 * writes an email with the figure already in it, because the honest version of
 * "Invest Now" at this stage is "tell us what you are thinking of, and we will
 * reply". Pretending otherwise would be the one thing on a raise page you
 * cannot come back from.
 */
export function RaiseCard({
  facts,
}: {
  facts: { label: string; value: string }[]
}) {
  const [amount, setAmount] = useState('')

  const clean = amount.replace(/[^\d]/g, '')
  const pretty = clean ? `$${Number(clean).toLocaleString('en-US')}` : ''

  const body = [
    'Hello,',
    '',
    clean
      ? `I would like to talk about investing ${pretty} in nipsol.`
      : 'I would like to talk about investing in nipsol.',
    '',
    'A little about me:',
    '',
  ].join('\n')

  const href =
    `mailto:${CONTACT_EMAIL}` +
    `?subject=${encodeURIComponent('nipsol — investment enquiry')}` +
    `&body=${encodeURIComponent(body)}`

  return (
    <div className="rounded-[26px] border border-zinc-900/[0.07] bg-white p-6 shadow-[0_12px_40px_-16px_rgba(71,96,145,.35)]">
      <dl>
        {facts.map((fact, i) => (
          <div key={fact.label} className={i ? 'mt-5 border-t border-zinc-100 pt-5' : ''}>
            <dt className="text-[14px] text-zinc-500">{fact.label}</dt>
            <dd className="mt-1 text-[26px] font-semibold tracking-tight text-zinc-900">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>

      <label
        htmlFor="amount"
        className="mt-6 block text-[14px] font-semibold text-zinc-900"
      >
        What are you thinking of?
      </label>
      <input
        id="amount"
        inputMode="numeric"
        value={pretty}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="$50,000"
        className="mt-2 h-14 w-full rounded-2xl border border-zinc-200 px-4 text-[18px] text-zinc-900 outline-none transition placeholder:text-zinc-300 focus:border-zinc-400"
      />

      <a
        href={href}
        className="mt-3 flex h-14 items-center justify-center rounded-2xl bg-gradient-to-b from-[#2f70ee] to-[#2363df] text-[17px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15)] transition hover:brightness-[1.06]"
      >
        Invest now
      </a>

      <p className="mt-3 text-center text-[12.5px] leading-relaxed text-zinc-400">
        This opens an email, not a payment. Nothing is committed by writing to us.
      </p>
    </div>
  )
}
