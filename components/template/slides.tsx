'use client'

import { ACCENTS, IconChip, Photo, Reveal, SlideFrame, SlideHeader, type SlideProps } from './primitives'
import { ChartSlide, StatsSlide, TableSlide } from './data-slides'
import { FunnelSlide, MindmapSlide, StepsSlide, TimelineSlide } from './flow-slides'
import { CompareSlide, GallerySlide, HeroSlide, SpotlightSlide } from './photo-slides'

export { ACCENTS } from './primitives'
export type { SlideProps } from './primitives'

/* ------------------------------------------------------------------ */
/* Journey — the winding milestone road from the reference template.   */
/* ------------------------------------------------------------------ */

export function JourneySlide({ scene, revealed, itemImages }: SlideProps) {
  const items = scene.items
  const n = Math.max(1, items.length)

  // Design-space coordinates (1200x700). The container keeps that aspect
  // ratio, so SVG coordinates and %-positioned HTML cards line up exactly.
  const nodes = items.map((_, i) => ({
    x: 430 + i * (n > 1 ? 140 / (n - 1) : 0),
    y: n > 1 ? 100 + i * (500 / (n - 1)) : 350,
  }))

  const segment = (i: number) => {
    const a = nodes[i]
    const b = nodes[i + 1]
    const bend = (b.y - a.y) * 0.55
    return `M ${a.x} ${a.y} C ${a.x - 60} ${a.y + bend}, ${b.x + 60} ${b.y - bend}, ${b.x} ${b.y}`
  }

  return (
    <div className="relative h-full w-full">
      {/* Top-left like every other template, so the eye always starts in the
          same place regardless of which layout the scene chose. */}
      <div className="absolute left-[6%] top-[8%] w-[30%]">
        <SlideHeader scene={scene} />
      </div>

      <svg viewBox="0 0 1200 700" className="absolute inset-0 h-full w-full">
        {items.slice(0, -1).map((_, i) => (
          <g key={i}>
            <path
              d={segment(i)}
              fill="none"
              stroke={ACCENTS[(i + 1) % ACCENTS.length]}
              strokeWidth={24}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={100}
              strokeDashoffset={revealed > i + 1 ? 0 : 100}
              style={{ transition: 'stroke-dashoffset 900ms ease' }}
            />
            <path
              d={segment(i)}
              fill="none"
              stroke="white"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray="1 16"
              pathLength={100}
              style={{ opacity: revealed > i + 1 ? 0.9 : 0, transition: 'opacity 900ms ease 300ms' }}
            />
          </g>
        ))}
        {nodes.map((node, i) => (
          <circle
            key={i}
            cx={node.x}
            cy={node.y}
            r={26}
            fill="white"
            stroke={ACCENTS[i % ACCENTS.length]}
            strokeWidth={16}
            style={{
              opacity: revealed > i ? 1 : 0,
              transformOrigin: `${node.x}px ${node.y}px`,
              transform: revealed > i ? 'scale(1)' : 'scale(0.4)',
              transition: 'opacity 500ms ease, transform 500ms cubic-bezier(.34,1.4,.64,1)',
            }}
          />
        ))}
      </svg>

      {items.map((item, i) => (
        <Reveal
          key={i}
          on={revealed > i}
          className="absolute flex w-[34%] items-center gap-3 overflow-hidden rounded-2xl bg-white p-2.5 shadow-[0_8px_30px_rgba(24,32,63,0.08)]"
          style={{
            left: `${(nodes[i].x + 70) / 12}%`,
            top: `${nodes[i].y / 7}%`,
            marginTop: '-2.6rem',
          }}
        >
          {/* The picture is the card. Without it a milestone is two words on a
              large white rectangle, which is worse than no card at all. */}
          {item.image ? (
            <Photo
              image={itemImages?.[i]}
              alt={item.image}
              rounded="rounded-xl"
              className="aspect-square w-[30%] shrink-0"
            />
          ) : (
            <IconChip icon={item.icon} color={ACCENTS[i % ACCENTS.length]} />
          )}
          <div className="min-w-0 pr-1">
            <h3 className="text-[clamp(12px,1.25vw,18px)] font-semibold text-zinc-900">
              {item.heading}
            </h3>
            {item.body && (
              <p className="mt-0.5 text-[clamp(10px,1vw,14px)] leading-snug text-zinc-500">
                {item.body}
              </p>
            )}
          </div>
        </Reveal>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Pillars — a row of numbered cards.                                  */
/* ------------------------------------------------------------------ */

export function PillarsSlide({ scene, revealed, itemImages }: SlideProps) {
  return (
    <SlideFrame scene={scene}>
      <div className="flex w-full items-stretch gap-[2.5%]">
        {scene.items.map((item, i) => (
          <Reveal
            key={i}
            on={revealed > i}
            delayMs={60}
            className="flex flex-1 flex-col overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgba(24,32,63,0.08)]"
          >
            {/* A card carries its own photograph when the model gave it one,
                so a scene is not limited to a single picture. */}
            {item.image && (
              <Photo
                image={itemImages?.[i]}
                alt={item.image}
                rounded="rounded-none"
                className="aspect-[16/10] w-full"
              />
            )}
            <div className="flex flex-1 flex-col px-6 py-7">
            <IconChip
              icon={item.icon}
              color={ACCENTS[i % ACCENTS.length]}
              size={64}
              radius="rounded-2xl"
            />
            <h3 className="mt-4 text-[clamp(13px,1.3vw,19px)] font-semibold text-zinc-900">
              {item.heading}
            </h3>
            {item.body && (
              <p className="mt-2 text-[clamp(11px,1.05vw,14px)] leading-relaxed text-zinc-500">
                {item.body}
              </p>
            )}
            <span
              className="mt-auto pt-5 text-xs font-semibold tracking-widest"
              style={{ color: ACCENTS[i % ACCENTS.length] }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            </div>
          </Reveal>
        ))}
      </div>
    </SlideFrame>
  )
}

/** Dispatches a scene to its template's slide component. */
export function Slide(props: SlideProps) {
  switch (props.scene.template) {
    case 'pillars':
      return <PillarsSlide {...props} />
    case 'spotlight':
      return <SpotlightSlide {...props} />
    case 'timeline':
      return <TimelineSlide {...props} />
    case 'steps':
      return <StepsSlide {...props} />
    case 'funnel':
      return <FunnelSlide {...props} />
    case 'mindmap':
      return <MindmapSlide {...props} />
    case 'gallery':
      return <GallerySlide {...props} />
    case 'compare':
      return <CompareSlide {...props} />
    case 'hero':
      return <HeroSlide {...props} />
    case 'table':
      return <TableSlide {...props} />
    case 'chart':
      return <ChartSlide {...props} />
    case 'stats':
      return <StatsSlide {...props} />
    default:
      return <JourneySlide {...props} />
  }
}
