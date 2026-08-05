'use client'

import { ACCENTS, IconChip, Reveal, SlideHeader, type SlideProps } from './primitives'

/* ------------------------------------------------------------------ */
/* Timeline — horizontal chevrons with captions above and below.       */
/* ------------------------------------------------------------------ */

export function TimelineSlide({ scene, revealed }: SlideProps) {
  const items = scene.items

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-[4%]">
      <SlideHeader scene={scene} />

      <div className="relative mt-[4%] flex w-full items-center justify-center">
        {items.map((item, i) => {
          const above = i % 2 === 0
          const accent = ACCENTS[i % ACCENTS.length]
          return (
            <div key={i} className="relative flex flex-1 flex-col items-center">
              {/* Caption sits above or below, alternating along the track. */}
              <Reveal
                on={revealed > i}
                className="absolute w-[92%] px-1"
                style={{ [above ? 'bottom' : 'top']: '4.6rem' } as React.CSSProperties}
              >
                <span
                  className="inline-block rounded-md px-2 py-0.5 text-[clamp(10px,1.05vw,15px)] font-bold text-zinc-900"
                  style={{ background: `${accent}33` }}
                >
                  {item.heading}
                </span>
                <p className="mt-1.5 text-[clamp(9px,0.92vw,13px)] leading-snug text-zinc-500">
                  {item.body}
                </p>
              </Reveal>

              {/* Chevron: a circle badge with an arrow head behind it. */}
              <Reveal on={revealed > i} className="flex items-center">
                <span className="z-10 flex size-[clamp(34px,3.6vw,56px)] items-center justify-center rounded-full bg-zinc-100 text-[clamp(10px,1vw,14px)] font-bold text-zinc-700">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className="-ml-3 h-[clamp(28px,3vw,46px)] w-[clamp(30px,3.2vw,50px)]"
                  style={{
                    background: accent,
                    clipPath: 'polygon(0 0, 55% 0, 100% 50%, 55% 100%, 0 100%)',
                  }}
                />
              </Reveal>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Steps — numbered badges in a row, captions beneath.                 */
/* ------------------------------------------------------------------ */

export function StepsSlide({ scene, revealed }: SlideProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-[5%]">
      <SlideHeader scene={scene} />

      <div className="relative mt-[6%] flex w-full items-start justify-center gap-[2%]">
        {/* The rail the badges sit on. */}
        <span className="absolute left-[6%] right-[6%] top-[2.6rem] h-0.5 bg-zinc-200" />

        {scene.items.map((item, i) => (
          <Reveal
            key={i}
            on={revealed > i}
            delayMs={40}
            className="relative flex flex-1 flex-col items-center text-center"
          >
            <IconChip icon={item.icon} color={ACCENTS[i % ACCENTS.length]} size={54} radius="rounded-2xl" />
            <span
              className="mt-3 text-[clamp(14px,1.6vw,24px)] font-extrabold"
              style={{ color: ACCENTS[i % ACCENTS.length] }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="mt-1 text-[clamp(11px,1.1vw,16px)] font-semibold text-zinc-900">
              {item.heading}
            </h3>
            {item.body && (
              <p className="mt-1 text-[clamp(9px,0.92vw,13px)] leading-snug text-zinc-500">
                {item.body}
              </p>
            )}
          </Reveal>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Funnel — narrowing stages.                                          */
/* ------------------------------------------------------------------ */

export function FunnelSlide({ scene, revealed }: SlideProps) {
  const items = scene.items
  const n = Math.max(1, items.length)

  return (
    <div className="flex h-full w-full items-center gap-[4%] px-[6%]">
      <div className="w-[26%] shrink-0">
        <SlideHeader scene={scene} align="left" />
      </div>

      <div className="flex flex-1 flex-col items-center gap-2">
        {items.map((item, i) => {
          // Each stage is narrower than the last: that taper is the whole idea.
          const width = 100 - (i / n) * 46
          return (
            <Reveal key={i} on={revealed > i} className="flex w-full items-center gap-4">
              <div
                className="flex items-center justify-center rounded-lg px-4 py-[clamp(8px,1.4vh,16px)] text-center text-white shadow-sm"
                style={{ width: `${width}%`, background: ACCENTS[i % ACCENTS.length] }}
              >
                <span className="emoji mr-2" aria-hidden>
                  {item.icon}
                </span>
                <span className="text-[clamp(11px,1.15vw,16px)] font-semibold">{item.heading}</span>
              </div>
              <p className="flex-1 text-[clamp(9px,0.95vw,13px)] leading-snug text-zinc-500">
                {item.body}
              </p>
            </Reveal>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Mindmap — a hub with items radiating to both sides.                 */
/* ------------------------------------------------------------------ */

export function MindmapSlide({ scene, revealed }: SlideProps) {
  const items = scene.items
  const half = Math.ceil(items.length / 2)
  const left = items.slice(0, half)
  const right = items.slice(half)

  const Card = ({ item, index, side }: { item: (typeof items)[number]; index: number; side: 'l' | 'r' }) => (
    <Reveal
      on={revealed > index}
      className={`flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_6px_24px_rgba(24,32,63,0.07)] ${
        side === 'l' ? 'flex-row-reverse text-right' : ''
      }`}
    >
      <IconChip icon={item.icon} color={ACCENTS[index % ACCENTS.length]} size={36} />
      <div className="min-w-0">
        <h3 className="text-[clamp(10px,1.05vw,15px)] font-semibold text-zinc-900">{item.heading}</h3>
        {item.body && (
          <p className="text-[clamp(9px,0.88vw,12px)] leading-snug text-zinc-500">{item.body}</p>
        )}
      </div>
    </Reveal>
  )

  return (
    <div className="flex h-full w-full items-center justify-center gap-[3%] px-[5%]">
      <div className="flex w-[30%] flex-col gap-3">
        {left.map((item, i) => (
          <Card key={i} item={item} index={i} side="l" />
        ))}
      </div>

      <div className="flex w-[24%] shrink-0 flex-col items-center text-center">
        <div className="flex aspect-square w-full max-w-[220px] flex-col items-center justify-center rounded-full border-[6px] border-dashed border-zinc-200 p-6">
          <h2 className="text-[clamp(15px,1.9vw,28px)] font-bold leading-tight text-zinc-900">
            {scene.title}
          </h2>
        </div>
        {scene.subtitle && (
          <p className="mt-3 text-[clamp(10px,1vw,14px)] text-zinc-500">{scene.subtitle}</p>
        )}
      </div>

      <div className="flex w-[30%] flex-col gap-3">
        {right.map((item, i) => (
          <Card key={i} item={item} index={half + i} side="r" />
        ))}
      </div>
    </div>
  )
}
