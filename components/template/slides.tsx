'use client'

import type { TemplateScene } from '@/lib/template-lesson'
import type { ImageResult } from '@/app/api/image/route'

/**
 * The design language, lifted from the reference template: light stage, white
 * cards, and one saturated accent per milestone running green → teal → blue →
 * purple. Slots change per scene; these colours and shapes never do — that
 * consistency is what makes the output read as designed rather than generated.
 */
export const ACCENTS = ['#2fbf71', '#00b8a9', '#2f80ed', '#7b61ff', '#e2447e'] as const

export interface SlideProps {
  scene: TemplateScene
  /** How many items are currently revealed by the narration. */
  revealed: number
  /** Resolved photo for `spotlight`; undefined = loading, null = none found. */
  image?: ImageResult | null
}

/** Shared reveal transition: rise and fade, styled once so slides agree. */
function revealStyle(on: boolean, delayMs = 0): React.CSSProperties {
  return {
    opacity: on ? 1 : 0,
    transform: on ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 600ms ease ${delayMs}ms, transform 600ms ease ${delayMs}ms`,
  }
}

function IconChip({ icon, color, size = 44 }: { icon: string; color: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
      style={{ width: size, height: size, background: color, fontSize: size * 0.5 }}
    >
      <span className="emoji" aria-hidden>
        {icon}
      </span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Journey — the winding milestone road from the reference template.   */
/* ------------------------------------------------------------------ */

export function JourneySlide({ scene, revealed }: SlideProps) {
  const items = scene.items
  const n = Math.max(1, items.length)

  // Design-space coordinates (1200x700). The container keeps the same aspect
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
      {/* Title block, as in the reference: left column, vertically low. */}
      <div
        className="absolute left-[3%] top-[52%] w-[27%] -translate-y-1/2"
        style={revealStyle(true)}
      >
        <h2 className="text-[clamp(20px,2.6vw,38px)] font-bold leading-tight text-zinc-900">
          {scene.title}
        </h2>
        {scene.subtitle && (
          <p className="mt-3 text-[clamp(12px,1.15vw,17px)] leading-relaxed text-zinc-500">
            {scene.subtitle}
          </p>
        )}
      </div>

      <svg viewBox="0 0 1200 700" className="absolute inset-0 h-full w-full">
        {/* Road segments draw in as the narration reaches each milestone. */}
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
              style={{
                opacity: revealed > i + 1 ? 0.9 : 0,
                transition: 'opacity 900ms ease 300ms',
              }}
            />
          </g>
        ))}
        {/* Donut milestones, echoing the reference's loop-the-loops. */}
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

      {/* Milestone cards, one per node, in a loosely staggered right column. */}
      {items.map((item, i) => (
        <div
          key={i}
          className="absolute flex w-[38%] items-start gap-3 rounded-2xl bg-white p-4 shadow-[0_8px_30px_rgba(24,32,63,0.08)]"
          style={{
            left: `${(nodes[i].x + 70) / 12}%`,
            top: `${nodes[i].y / 7}%`,
            transform: 'translateY(-50%)',
            ...revealStyle(revealed > i),
          }}
        >
          <IconChip icon={item.icon} color={ACCENTS[i % ACCENTS.length]} />
          <div className="min-w-0">
            <h3 className="text-[clamp(12px,1.25vw,18px)] font-semibold text-zinc-900">
              {item.heading}
            </h3>
            {item.body && (
              <p className="mt-0.5 text-[clamp(10px,1vw,14px)] leading-snug text-zinc-500">
                {item.body}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Pillars — a row of side-by-side cards.                              */
/* ------------------------------------------------------------------ */

export function PillarsSlide({ scene, revealed }: SlideProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-[6%]">
      <div className="mb-[4%] max-w-3xl text-center" style={revealStyle(true)}>
        <h2 className="text-[clamp(22px,2.6vw,38px)] font-bold text-zinc-900">{scene.title}</h2>
        {scene.subtitle && (
          <p className="mt-2 text-[clamp(13px,1.2vw,17px)] text-zinc-500">{scene.subtitle}</p>
        )}
      </div>

      <div className="flex w-full items-stretch justify-center gap-[2.5%]">
        {scene.items.map((item, i) => (
          <div
            key={i}
            className="flex w-[24%] min-w-40 flex-col items-center rounded-3xl bg-white px-5 py-8 text-center shadow-[0_8px_30px_rgba(24,32,63,0.08)]"
            style={revealStyle(revealed > i, 60)}
          >
            <span
              className="flex size-16 items-center justify-center rounded-2xl text-3xl text-white"
              style={{ background: ACCENTS[i % ACCENTS.length] }}
            >
              <span className="emoji" aria-hidden>
                {item.icon}
              </span>
            </span>
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
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Spotlight — one large photograph beside captioned points.           */
/* ------------------------------------------------------------------ */

export function SpotlightSlide({ scene, revealed, image }: SlideProps) {
  return (
    <div className="flex h-full w-full items-center gap-[4%] px-[5%]">
      <div className="relative w-[46%] shrink-0" style={revealStyle(true)}>
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-zinc-200 shadow-[0_16px_50px_rgba(24,32,63,0.16)]">
          {image?.src ? (
            // eslint-disable-next-line @next/next/no-img-element -- proxied, unoptimisable
            <img src={image.src} alt={scene.image} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-8 text-center text-sm text-zinc-400">
              {image === null ? scene.image : 'Fetching photograph…'}
            </div>
          )}
        </div>
        {image?.source && (
          <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
            {image.source}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div style={revealStyle(true)}>
          <h2 className="text-[clamp(22px,2.6vw,38px)] font-bold leading-tight text-zinc-900">
            {scene.title}
          </h2>
          {scene.subtitle && (
            <p className="mt-2 text-[clamp(13px,1.2vw,17px)] text-zinc-500">{scene.subtitle}</p>
          )}
        </div>

        <div className="mt-[5%] flex flex-col gap-4">
          {scene.items.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3.5 rounded-2xl bg-white p-4 shadow-[0_6px_24px_rgba(24,32,63,0.07)]"
              style={revealStyle(revealed > i)}
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
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Dispatches a scene to its template's slide component. */
export function Slide(props: SlideProps) {
  switch (props.scene.template) {
    case 'pillars':
      return <PillarsSlide {...props} />
    case 'spotlight':
      return <SpotlightSlide {...props} />
    default:
      return <JourneySlide {...props} />
  }
}
