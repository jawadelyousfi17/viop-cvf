'use client'

import type { ReactNode } from 'react'

/**
 * The drawing kit.
 *
 * Everything on a plate is driven by one number: how far past a given beat the
 * recording is. Nothing here schedules, queues or animates on its own — a scene
 * is a pure function of the clock, so scrubbing backwards is the same operation
 * as playing forwards and there is no state to get out of step with the voice.
 *
 * The one visual rule the kit enforces: ink is *drawn*, never placed. Every
 * outline is a path with `pathLength="1"`, so a 0→1 driver is a pen moving
 * along it, whatever the path's real length.
 */

/** Where the recording is, in the language a scene wants to think in. */
export interface Cue {
  /** 0→1 across the whole scene, for slow camera work. */
  p: number
  /** The beat being spoken, 1-based. */
  beat: number
  /**
   * 0→1 as beat `n` lands, eased. The workhorse: pass it to a stroke to draw
   * it, to an opacity to bring it in, to a transform to slide it.
   */
  at: (n: number, hold?: number) => number
  /** Seconds since this scene began. For anything that ticks. */
  t: number
}

export const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
/** Fast out of the gate, long settle — a hand starting confidently and easing. */
export const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3)
export const easeInOut = (x: number) =>
  clamp(x) < 0.5 ? 4 * clamp(x) ** 3 : 1 - Math.pow(-2 * clamp(x) + 2, 3) / 2
export const mix = (a: number, b: number, k: number) => a + (b - a) * k

/**
 * One slice of a driver, for drawing a figure in the order a hand draws it.
 *
 * The outline finishes before the detail starts. Staggering every stroke by a
 * small offset instead — which is what this replaced — meant that at any moment
 * mid-draw you saw six things each a third finished: a scatter of fragments
 * rather than a drawing in progress. A figure should look *unfinished* while it
 * is being made, never broken.
 */
export const seg = (k: number, from: number, to: number) =>
  clamp((clamp(k) - from) / (to - from))

/**
 * A stroke that draws itself.
 *
 * `pathLength="1"` normalises the dash maths, so one driver works for a 40px
 * tick and a 900px sweep without measuring either.
 */
export function Ink({
  d,
  k = 1,
  className = 'stroke',
  style,
}: {
  d: string
  k?: number
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <path
      d={d}
      pathLength={1}
      className={className}
      strokeDasharray={1}
      strokeDashoffset={1 - clamp(k)}
      style={style}
    />
  )
}

/** A rectangle traced as one continuous line, the way a hand draws one. */
export const rect = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y}H${x + w}V${y + h}H${x}Z`

/** A rectangle with the corners eased off — for anything that is a "thing". */
export function box(x: number, y: number, w: number, h: number, r = 3) {
  return (
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}` +
    `V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
    `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
    `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  )
}

/** Anything that appears rather than draws: a caption, a glyph, a wash. */
export function Fade({
  k,
  children,
  y = 6,
  className,
}: {
  k: number
  children: ReactNode
  y?: number
  className?: string
}) {
  const e = ease(k)
  return (
    <g className={className} opacity={e} transform={`translate(0 ${(1 - e) * y})`}>
      {children}
    </g>
  )
}

/**
 * An annotation on a leader line, the way a part is called out on a plate.
 *
 * The line draws first and the words arrive at its end, which is the order a
 * draughtsman does it in and the order that reads as *pointing* rather than as
 * two things that happened to appear together.
 */
export function Call({
  x,
  y,
  to,
  text,
  k,
  align = 'start',
  tone,
}: {
  x: number
  y: number
  to: [number, number]
  text: string
  k: number
  align?: 'start' | 'end' | 'middle'
  tone?: 'hot' | 'cool' | 'good'
}) {
  const [tx, ty] = to
  const elbow = align === 'end' ? x + 16 : x - 16
  return (
    <g>
      <Ink
        d={`M${tx} ${ty}L${elbow} ${y}L${x} ${y}`}
        k={clamp(k * 1.6)}
        className={`stroke hair ${tone ?? ''}`}
      />
      <circle cx={tx} cy={ty} r={2.6} className={`fillink ${tone ?? ''}`} opacity={ease(k)} />
      <Fade k={clamp((k - 0.45) * 2)} y={3}>
        <text
          x={x}
          y={y + 4}
          textAnchor={align}
          className="tech"
          fontSize={13}
          fill="var(--graphite)"
        >
          {text}
        </text>
      </Fade>
    </g>
  )
}

/** A number that counts up to itself. Nothing else says "measured" so quickly. */
export function Count({
  x,
  y,
  to,
  k,
  suffix = '',
  size = 34,
  tone = 'var(--ink)',
}: {
  x: number
  y: number
  to: number
  k: number
  suffix?: string
  size?: number
  tone?: string
}) {
  if (clamp(k) <= 0) return null
  const shown = Math.round(to * ease(k))
  return (
    <text x={x} y={y} className="tech" fontSize={size} fontWeight={600} fill={tone}>
      {shown.toLocaleString()}
      {suffix}
    </text>
  )
}

/** A line of type that writes on, a character at a time. */
export function Type({
  x,
  y,
  text,
  k,
  size = 18,
  className = 'tech',
  fill = 'var(--ink)',
  anchor = 'start',
  caret = false,
}: {
  x: number
  y: number
  text: string
  k: number
  size?: number
  className?: string
  fill?: string
  anchor?: 'start' | 'middle' | 'end'
  caret?: boolean
}) {
  const shown = text.slice(0, Math.round(text.length * clamp(k)))
  return (
    <text x={x} y={y} className={className} fontSize={size} fill={fill} textAnchor={anchor}>
      {shown}
      {caret && clamp(k) < 1 ? '▌' : ''}
    </text>
  )
}

/** The plate's heading, and its number. Fixed corner, every scene. */
export function Heading({ n, of, title, k }: { n: number; of: number; title: string; k: number }) {
  return (
    <g>
      <Fade k={k} y={10}>
        <text x={0} y={0} className="micro" fontSize={11}>
          plate {String(n).padStart(2, '0')} / {of}
        </text>
        <text x={0} y={46} className="title" fontSize={44} fill="var(--ink)">
          {title}
        </text>
      </Fade>
      <Ink d={`M0 66H${mix(0, 420, ease(k))}`} k={1} className="stroke hair" />
    </g>
  )
}

/* ---------------------------------------------------------------------------
 * The illustration kit — drawn for this lesson, not borrowed from an icon set.
 * Each takes a 0→1 driver and draws itself.
 * ------------------------------------------------------------------------- */

/** A container: a crate seen slightly from the side, with corrugations. */
export function Crate({ k, w = 120, h = 84, tone = '' }: { k: number; w?: number; h?: number; tone?: string }) {
  const ribs = [0.22, 0.4, 0.58, 0.76]
  return (
    <g>
      <Ink d={box(0, 0, w, h, 2)} k={seg(k, 0, 0.6)} className={`stroke ${tone}`} />
      <Ink d={`M0 ${h * 0.24}H${w}`} k={seg(k, 0.58, 0.74)} className={`stroke hair ${tone}`} />
      {ribs.map((r, i) => (
        <Ink
          key={i}
          d={`M${w * r} ${h * 0.24}V${h}`}
          k={seg(k, 0.72 + i * 0.07, 0.79 + i * 0.07)}
          className={`stroke hair ${tone}`}
        />
      ))}
    </g>
  )
}

/** A kernel: a die with legs. The one piece of silicon in the whole lesson. */
export function Die({ k, s = 76, tone = 'cool' }: { k: number; s?: number; tone?: string }) {
  const legs = [0.28, 0.5, 0.72]
  return (
    <g>
      <Ink d={box(s * 0.16, s * 0.16, s * 0.68, s * 0.68, 3)} k={seg(k, 0, 0.5)} className={`stroke ${tone}`} />
      <Ink d={box(s * 0.34, s * 0.34, s * 0.32, s * 0.32, 1)} k={seg(k, 0.48, 0.68)} className={`stroke hair ${tone}`} />
      {legs.map((p, i) => {
        const a = seg(k, 0.68 + i * 0.1, 0.78 + i * 0.1)
        return (
          <g key={i}>
            <Ink d={`M${s * p} ${s * 0.16}V${s * 0.04}`} k={a} className={`stroke hair ${tone}`} />
            <Ink d={`M${s * p} ${s * 0.84}V${s * 0.96}`} k={a} className={`stroke hair ${tone}`} />
            <Ink d={`M${s * 0.16} ${s * p}H${s * 0.04}`} k={a} className={`stroke hair ${tone}`} />
            <Ink d={`M${s * 0.84} ${s * p}H${s * 0.96}`} k={a} className={`stroke hair ${tone}`} />
          </g>
        )
      })}
    </g>
  )
}

/** A wall: the namespace glyph. Courses of brick, drawn one row at a time. */
export function Wall({ k, w = 120, h = 70, tone = 'hot' }: { k: number; w?: number; h?: number; tone?: string }) {
  const rows = 4
  const out = []
  for (let r = 0; r < rows; r++) {
    const y = (h / rows) * r
    out.push(
      <Ink
        key={`r${r}`}
        d={`M0 ${y}H${w}`}
        k={seg(k, 0.4 + r * 0.13, 0.53 + r * 0.13)}
        className={`stroke hair ${tone}`}
      />
    )
    const offset = r % 2 ? 0 : w / 8
    for (let c = 0; c <= 4; c++) {
      const x = offset + (w / 4) * c
      if (x <= 0 || x >= w) continue
      out.push(
        <Ink
          key={`b${r}${c}`}
          d={`M${x} ${y}V${y + h / rows}`}
          k={seg(k, 0.46 + r * 0.13, 0.58 + r * 0.13)}
          className={`stroke hair ${tone}`}
        />
      )
    }
  }
  out.push(<Ink key="edge" d={rect(0, 0, w, h)} k={seg(k, 0, 0.42)} className={`stroke ${tone}`} />)
  return <g>{out}</g>
}

/** A meter: the cgroup glyph. A dial with a needle that swings to `value`. */
export function Meter({
  k,
  value,
  r = 46,
  tone = 'amber',
}: {
  k: number
  value: number
  r?: number
  tone?: string
}) {
  const a = mix(Math.PI * 0.82, Math.PI * 0.18, clamp(value))
  return (
    <g>
      <Ink
        d={`M${r - Math.cos(Math.PI * 0.82) * r} ${r - Math.sin(Math.PI * 0.82) * r}A${r} ${r} 0 0 1 ${
          r - Math.cos(Math.PI * 0.18) * r
        } ${r - Math.sin(Math.PI * 0.18) * r}`}
        k={seg(k, 0, 0.5)}
        className={`stroke ${tone}`}
      />
      {[0, 0.25, 0.5, 0.75, 1].map((m, i) => {
        const ta = mix(Math.PI * 0.82, Math.PI * 0.18, m)
        return (
          <Ink
            key={i}
            d={`M${r - Math.cos(ta) * r} ${r - Math.sin(ta) * r}L${r - Math.cos(ta) * (r - 9)} ${
              r - Math.sin(ta) * (r - 9)
            }`}
            k={seg(k, 0.5 + i * 0.05, 0.6 + i * 0.05)}
            className="stroke hair"
          />
        )
      })}
      <Ink
        d={`M${r} ${r}L${r - Math.cos(a) * (r - 14)} ${r - Math.sin(a) * (r - 14)}`}
        k={seg(k, 0.78, 1)}
        className={`stroke heavy ${value > 0.92 ? 'hot' : tone}`}
      />
      <circle cx={r} cy={r} r={3.4} className="fillink" opacity={ease(seg(k, 0.78, 1))} />
    </g>
  )
}

/** A switch: the bridge glyph. A body with ports and a pair of link lamps. */
export function Switchbox({ k, w = 150, h = 46 }: { k: number; w?: number; h?: number }) {
  return (
    <g>
      <Ink d={box(0, 0, w, h, 3)} k={seg(k, 0, 0.5)} className="stroke cool" />
      {[0.14, 0.3, 0.46, 0.62, 0.78].map((p, i) => (
        <Ink
          key={i}
          d={box(w * p - 8, h * 0.55, 16, 12, 1)}
          k={seg(k, 0.5 + i * 0.07, 0.6 + i * 0.07)}
          className="stroke hair cool"
        />
      ))}
      <circle cx={w * 0.9} cy={h * 0.34} r={3} className="fillcool" opacity={ease(seg(k, 0.85, 1))} />
      <circle cx={w * 0.9} cy={h * 0.62} r={3} className="fillcool" opacity={ease(seg(k, 0.9, 1))} />
    </g>
  )
}

/** A stopwatch whose hand actually sweeps. */
export function Watch({ k, spin, r = 34 }: { k: number; spin: number; r?: number }) {
  const a = -Math.PI / 2 + spin * Math.PI * 2
  return (
    <g>
      <Ink d={`M${r} 4a${r - 4} ${r - 4} 0 1 1-0.1 0Z`} k={seg(k, 0, 0.62)} className="stroke" />
      <Ink d={`M${r - 9} 2h18`} k={seg(k, 0.6, 0.76)} className="stroke" />
      <Ink d={`M${r} 2v6`} k={seg(k, 0.6, 0.76)} className="stroke hair" />
      <line
        x1={r}
        y1={r}
        x2={r + Math.cos(a) * (r - 13)}
        y2={r + Math.sin(a) * (r - 13)}
        className="stroke hot"
        strokeWidth={2.4}
        opacity={ease(seg(k, 0.76, 1))}
      />
      <circle cx={r} cy={r} r={2.6} className="fillink" opacity={ease(seg(k, 0.76, 1))} />
    </g>
  )
}

/** A single file, for anything that gets copied, mounted or thrown away. */
export function Sheet({ k, w = 44, h = 56, tone = '' }: { k: number; w?: number; h?: number; tone?: string }) {
  const fold = 13
  return (
    <g>
      <Ink
        d={`M0 0H${w - fold}L${w} ${fold}V${h}H0Z`}
        k={k}
        className={`stroke ${tone}`}
      />
      <Ink d={`M${w - fold} 0V${fold}H${w}`} k={seg(k, 0.55, 0.7)} className={`stroke hair ${tone}`} />
      {[0.5, 0.66, 0.82].map((p, i) => (
        <Ink key={i} d={`M8 ${h * p}H${w - 8}`} k={seg(k, 0.7 + i * 0.1, 0.8 + i * 0.1)} className="stroke hair" />
      ))}
    </g>
  )
}

/** A person, for the one moment the lesson talks about a human. */
export function Figure({ k, s = 54 }: { k: number; s?: number }) {
  return (
    <g>
      <Ink d={`M${s / 2} ${s * 0.1}a${s * 0.13} ${s * 0.13} 0 1 1-0.1 0Z`} k={k} className="stroke" />
      <Ink
        d={`M${s * 0.16} ${s} q0-${s * 0.42} ${s * 0.34}-${s * 0.42} q${s * 0.34} 0 ${s * 0.34} ${s * 0.42}`}
        k={clamp(k * 1.6 - 0.4)}
        className="stroke"
      />
    </g>
  )
}
