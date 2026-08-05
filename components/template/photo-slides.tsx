'use client'

import { ACCENTS, IconChip, Photo, Reveal, SlideFrame, SlideHeader, type SlideProps } from './primitives'

/* ------------------------------------------------------------------ */
/* Spotlight — one large photograph beside captioned points.           */
/* ------------------------------------------------------------------ */

export function SpotlightSlide({ scene, revealed, image }: SlideProps) {
  return (
    <div className="flex h-full w-full items-center gap-[5%] px-[6%] py-[5%]">
      {/* Words on the left, photograph on the right: the title sits where the
          eye already starts, and the picture rewards the sweep across. */}
      <div className="flex min-w-0 flex-1 flex-col self-start pt-[2%]">
        <SlideHeader scene={scene} />

        <div className="mt-[6%] flex flex-col gap-4">
          {scene.items.map((item, i) => (
            <Reveal
              key={i}
              on={revealed > i}
              className="flex items-start gap-3.5 rounded-2xl bg-white p-4 shadow-[0_6px_24px_rgba(24,32,63,0.07)]"
            >
              <IconChip icon={item.icon} color={ACCENTS[i % ACCENTS.length]} size={40} />
              <div className="min-w-0">
                <h3 className="text-[clamp(13px,1.25vw,18px)] font-semibold text-zinc-900">
                  {item.heading}
                </h3>
                {item.body && (
                  <p className="mt-0.5 text-[clamp(11px,1.05vw,14px)] leading-snug text-zinc-500">
                    {item.body}
                  </p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <Reveal on className="w-[44%] shrink-0">
        <Photo
          image={image}
          alt={scene.image}
          className="aspect-[4/3] shadow-[0_16px_50px_rgba(24,32,63,0.16)]"
        />
      </Reveal>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Gallery — a grid of photographs, one per item.                      */
/* ------------------------------------------------------------------ */

export function GallerySlide({ scene, revealed, itemImages }: SlideProps) {
  const items = scene.items
  const columns = items.length <= 4 ? items.length : 3

  return (
    <SlideFrame scene={scene}>
      <div
        className="grid w-full gap-[2.5%]"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))` }}
      >
        {items.map((item, i) => (
          <Reveal
            key={i}
            on={revealed > i}
            delayMs={40}
            className="overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgba(24,32,63,0.08)]"
          >
            <Photo
              image={itemImages?.[i]}
              alt={item.image || item.heading}
              rounded="rounded-none"
              className="aspect-[4/3] w-full"
            />
            <div className="flex items-start gap-2.5 p-3.5">
              <IconChip icon={item.icon} color={ACCENTS[i % ACCENTS.length]} size={30} radius="rounded-lg" />
              <div className="min-w-0">
                <h3 className="text-[clamp(10px,1.05vw,15px)] font-semibold text-zinc-900">
                  {item.heading}
                </h3>
                {item.body && (
                  <p className="mt-0.5 text-[clamp(9px,0.9vw,12px)] leading-snug text-zinc-500">
                    {item.body}
                  </p>
                )}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </SlideFrame>
  )
}

/* ------------------------------------------------------------------ */
/* Compare — two photographed things, side by side.                    */
/* ------------------------------------------------------------------ */

export function CompareSlide({ scene, revealed, itemImages }: SlideProps) {
  return (
    <SlideFrame scene={scene}>
      <div className="grid w-full grid-cols-2 gap-[4%]">
        {scene.items.slice(0, 2).map((item, i) => (
          <Reveal
            key={i}
            on={revealed > i}
            delayMs={i * 80}
            className="overflow-hidden rounded-3xl bg-white shadow-[0_10px_36px_rgba(24,32,63,0.09)]"
          >
            <Photo
              image={itemImages?.[i]}
              alt={item.image || item.heading}
              rounded="rounded-none"
              className="aspect-[16/10] w-full"
            />
            <div className="flex items-start gap-3 p-5">
              <IconChip icon={item.icon} color={ACCENTS[i % ACCENTS.length]} size={38} />
              <div className="min-w-0">
                <h3 className="text-[clamp(12px,1.25vw,18px)] font-semibold text-zinc-900">
                  {item.heading}
                </h3>
                {item.body && (
                  <p className="mt-1 text-[clamp(10px,1vw,14px)] leading-snug text-zinc-500">
                    {item.body}
                  </p>
                )}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </SlideFrame>
  )
}

/* ------------------------------------------------------------------ */
/* Hero — a full-bleed photograph with the title over it.              */
/* ------------------------------------------------------------------ */

export function HeroSlide({ scene, revealed, image }: SlideProps) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[2rem] shadow-[0_20px_60px_rgba(24,32,63,0.18)]">
      <Photo
        image={image}
        alt={scene.image}
        rounded="rounded-none"
        position="absolute"
        className="inset-0 h-full w-full"
      />
      {/* Scrim: the title has to stay legible over an unknown photograph. */}
      <div className="absolute inset-0 z-[5] bg-gradient-to-r from-black/85 via-black/50 to-black/10" />

      <div className="relative z-10 flex h-full w-full flex-col justify-center px-[7%] pb-[6%] pt-[10%]">
        <Reveal on className="max-w-[56%]">
          <h2 className="text-[clamp(26px,3.6vw,58px)] font-extrabold leading-[1.05] text-white drop-shadow">
            {scene.title}
          </h2>
          {scene.subtitle && (
            <p className="mt-4 text-[clamp(13px,1.35vw,20px)] leading-relaxed text-white/85">
              {scene.subtitle}
            </p>
          )}
        </Reveal>

        {scene.items.length > 0 && (
          <div className="mt-[4%] flex max-w-[62%] flex-wrap gap-2.5">
            {scene.items.map((item, i) => (
              <Reveal
                key={i}
                on={revealed > i}
                className="flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 backdrop-blur-md"
              >
                <span className="emoji text-base" aria-hidden>
                  {item.icon}
                </span>
                <span className="text-[clamp(10px,1vw,14px)] font-medium text-white">
                  {item.heading}
                </span>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
