'use client'

import { parseGrid } from '@/lib/template-lesson'
import { ACCENTS, Reveal, SlideFrame, type SlideProps } from './primitives'

/* ------------------------------------------------------------------ */
/* Table — a designed data grid.                                       */
/* ------------------------------------------------------------------ */

export function TableSlide({ scene, revealed }: SlideProps) {
  const rows = parseGrid(scene.data)
  const header = rows[0] ?? []
  const body = rows.slice(1)
  // Rows reveal with the narration when items time them; otherwise all at once.
  const shown = scene.items.length ? Math.ceil((revealed / scene.items.length) * body.length) : body.length

  return (
    <SlideFrame scene={scene}>
      <div className="w-full max-w-[86%] overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgba(24,32,63,0.08)]">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, header.length)}, minmax(0, 1fr))` }}
        >
          {header.map((cell, c) => (
            <div
              key={c}
              className="px-5 py-4 text-[clamp(11px,1.1vw,15px)] font-semibold text-white"
              style={{ background: ACCENTS[0] }}
            >
              {cell}
            </div>
          ))}
          {body.map((row, r) =>
            Array.from({ length: Math.max(1, header.length) }, (_, c) => (
              <div
                key={`${r}-${c}`}
                className="border-t border-zinc-100 px-5 py-3.5 text-[clamp(11px,1.05vw,15px)] text-zinc-700"
                style={{
                  background: r % 2 ? '#fafbfc' : 'white',
                  opacity: r < shown ? 1 : 0,
                  transform: r < shown ? 'translateY(0)' : 'translateY(8px)',
                  transition: `opacity 450ms ease ${r * 60}ms, transform 450ms ease ${r * 60}ms`,
                  fontWeight: c === 0 ? 600 : 400,
                  color: c === 0 ? '#18181b' : undefined,
                }}
              >
                {row[c] ?? ''}
              </div>
            ))
          )}
        </div>
      </div>
    </SlideFrame>
  )
}

/* ------------------------------------------------------------------ */
/* Chart — bars drawn to scale, with their values.                     */
/* ------------------------------------------------------------------ */

export function ChartSlide({ scene, revealed }: SlideProps) {
  const entries = parseGrid(scene.data)
    .map((row) => ({ label: row[0] ?? '', raw: row[1] ?? '', value: Number(String(row[1]).replace(/[^0-9.-]/g, '')) }))
    .filter((entry) => Number.isFinite(entry.value))

  const peak = Math.max(1, ...entries.map((entry) => Math.abs(entry.value)))
  const shown = scene.items.length
    ? Math.ceil((revealed / scene.items.length) * entries.length)
    : entries.length

  return (
    <SlideFrame scene={scene}>
      <div className="flex h-[58%] w-full max-w-[80%] items-end gap-[3%] border-b-2 border-zinc-200">
        {entries.map((entry, i) => {
          const height = (Math.abs(entry.value) / peak) * 100
          const on = i < shown
          return (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end">
              <span
                className="mb-2 text-[clamp(12px,1.3vw,19px)] font-bold"
                style={{
                  color: ACCENTS[i % ACCENTS.length],
                  opacity: on ? 1 : 0,
                  transition: `opacity 400ms ease ${i * 90 + 350}ms`,
                }}
              >
                {entry.raw}
              </span>
              <div
                className="w-full rounded-t-xl"
                style={{
                  height: on ? `${height}%` : 0,
                  background: ACCENTS[i % ACCENTS.length],
                  transition: `height 700ms cubic-bezier(.22,1,.36,1) ${i * 90}ms`,
                }}
              />
            </div>
          )
        })}
      </div>

      <div className="flex w-full max-w-[80%] gap-[3%] pt-3">
        {entries.map((entry, i) => (
          <span
            key={i}
            className="flex-1 text-center text-[clamp(10px,1vw,14px)] text-zinc-500"
            style={{ opacity: i < shown ? 1 : 0, transition: `opacity 400ms ease ${i * 90}ms` }}
          >
            {entry.label}
          </span>
        ))}
      </div>
    </SlideFrame>
  )
}

/* ------------------------------------------------------------------ */
/* Stats — a few large figures.                                        */
/* ------------------------------------------------------------------ */

export function StatsSlide({ scene, revealed }: SlideProps) {
  return (
    <SlideFrame scene={scene}>
      <div className="flex w-full items-stretch gap-[3%]">
        {scene.items.map((item, i) => (
          <Reveal
            key={i}
            on={revealed > i}
            className="flex flex-1 flex-col rounded-3xl bg-white px-7 py-9 shadow-[0_8px_30px_rgba(24,32,63,0.08)]"
          >
            <span
              className="text-[clamp(28px,4.4vw,64px)] font-extrabold leading-none"
              style={{ color: ACCENTS[i % ACCENTS.length] }}
            >
              {item.heading}
            </span>
            {item.body && (
              <p className="mt-3 text-[clamp(11px,1.1vw,15px)] leading-snug text-zinc-500">
                {item.body}
              </p>
            )}
          </Reveal>
        ))}
      </div>
    </SlideFrame>
  )
}
