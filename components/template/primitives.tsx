'use client'

import type { TemplateScene } from '@/lib/template-lesson'
import type { ImageResult } from '@/app/api/image/route'

/**
 * The design language shared by every template: light stage, white cards, and
 * one saturated accent per position running green → teal → blue → purple →
 * pink. Slots change per scene; these tokens never do, and that consistency is
 * what makes the output read as designed rather than generated.
 */
export const ACCENTS = ['#2fbf71', '#00b8a9', '#2f80ed', '#7b61ff', '#e2447e', '#f2994a'] as const

export interface SlideProps {
  scene: TemplateScene
  /** How many items the narration has revealed so far. */
  revealed: number
  /** Scene-level photo: undefined = loading, null = none found. */
  image?: ImageResult | null
  /** Per-item photos for gallery templates, keyed by item index. */
  itemImages?: Record<number, ImageResult | null>
}

/** Shared rise-and-fade reveal, so every template agrees on the motion. */
export function Reveal({
  on,
  delayMs = 0,
  className,
  style,
  children,
}: {
  on: boolean
  delayMs?: number
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <div
      className={className}
      style={{
        opacity: on ? 1 : 0,
        transform: on ? 'translateY(0)' : 'translateY(14px)',
        transition: `opacity 600ms ease ${delayMs}ms, transform 600ms ease ${delayMs}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Title + subtitle. Left-aligned and capped at roughly two thirds width, so it
 * forms the top bar of an F rather than a centred banner the eye has to find.
 */
export function SlideHeader({ scene }: { scene: TemplateScene }) {
  return (
    <div className="max-w-[68%]">
      <h2 className="text-[clamp(22px,2.6vw,38px)] font-bold leading-tight text-zinc-900">
        {scene.title}
      </h2>
      {scene.subtitle && (
        <p className="mt-2 text-[clamp(12px,1.2vw,17px)] leading-relaxed text-zinc-500">
          {scene.subtitle}
        </p>
      )}
    </div>
  )
}

/**
 * The frame every content slide sits in.
 *
 * Readers scan in an F: along the top, back to the left edge, down and across
 * again. So each slide puts its title in the same top-left corner and hangs the
 * body directly beneath it on the same left margin. The consistency is the
 * point — the eye stops hunting for where a slide begins, which is most of what
 * makes a deck feel calm rather than busy.
 */
export function SlideFrame({
  scene,
  children,
  className = '',
}: {
  scene: TemplateScene
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="flex h-full w-full flex-col px-[6%] py-[5%]">
      <SlideHeader scene={scene} />
      {/* Content hangs from the header on the same margin rather than floating
          mid-slide: in an F the eye returns to the left edge, not the centre. */}
      <div className={`mt-[4%] flex min-h-0 flex-1 flex-col justify-start ${className}`}>
        {children}
      </div>
    </div>
  )
}

/** Rounded accent tile holding one emoji. */
export function IconChip({
  icon,
  color,
  size = 44,
  radius = 'rounded-xl',
}: {
  icon: string
  color: string
  size?: number
  radius?: string
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${radius} text-white shadow-sm`}
      style={{ width: size, height: size, background: color, fontSize: size * 0.5 }}
    >
      <span className="emoji" aria-hidden>
        {icon}
      </span>
    </span>
  )
}

/** A photograph in a rounded frame, with its source credited. */
export function Photo({
  image,
  alt,
  className = '',
  rounded = 'rounded-3xl',
  position = 'relative',
}: {
  image?: ImageResult | null
  alt: string
  className?: string
  rounded?: string
  /**
   * Explicit rather than passed through `className`: Tailwind gives `relative`
   * and `absolute` equal specificity, so having both on one element resolves by
   * stylesheet order, not class order. That silently dropped the hero slide's
   * title out of its clipped container.
   */
  position?: 'relative' | 'absolute'
}) {
  return (
    <div className={`${position} overflow-hidden bg-zinc-200 ${rounded} ${className}`}>
      {image?.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- proxied, unoptimisable
        <img
          src={image.src}
          alt=""
          className="h-full w-full object-cover"
          // A dead upstream would otherwise render the query as broken-image
          // alt text across the card, which looks worse than an empty frame.
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-6 text-center text-xs text-zinc-400">
          {image === null ? alt : 'Fetching photograph…'}
        </div>
      )}
      {image?.source && (
        <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-medium text-white backdrop-blur">
          {image.source}
        </span>
      )}
    </div>
  )
}
