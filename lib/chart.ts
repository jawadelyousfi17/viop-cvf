/**
 * Charts, drawn as SVG for the server to rasterise into a PNG.
 *
 * tldraw can draw axes and bars, but only as loose shapes the model has to
 * position by hand — which is how a bar chart ends up with its labels on top of
 * its bars. A chart is one image with its own internal layout, so nothing
 * inside it can collide with anything else on the board.
 */

export const CHART_KINDS = ['barchart', 'linechart', 'piechart'] as const
export type ChartKind = (typeof CHART_KINDS)[number]

export interface ChartPoint {
  label: string
  value: number
}

export interface ChartSpec {
  kind: ChartKind
  title: string
  data: ChartPoint[]
  /** Hex, from the board palette. */
  color: string
}

/** One typeface everywhere, matching the lettering on the board. */
const FONT = "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive, sans-serif"
const INK = '#1d1d1d'
const RULE = '#7a828e'

/**
 * The lookup key a rendered chart is filed under.
 *
 * Charts ride the board's image path — placeholder frame, swap-in when it
 * lands, aspect-ratio fitting — which is keyed by search query. A chart has no
 * query, so it gets a synthetic one. Scene-scoped because shape ids only have
 * to be unique within a scene.
 */
export function chartKey(sceneIndex: number, shapeId: string) {
  return `chart:${sceneIndex}:${shapeId}`
}

export const CHART_W = 900
export const CHART_H = 620

/** SVG text is markup, so a label with an angle bracket in it must be escaped. */
function esc(value: string) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!
  )
}

function n(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback
}

/** Trims a number to something a human would write on a board. */
function pretty(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(abs < 1 ? 2 : 1)
}

export function chartToSvg(spec: ChartSpec): string {
  const data = (spec.data ?? [])
    .filter((point) => point && Number.isFinite(point.value))
    .slice(0, 12)
    .map((point) => ({ label: String(point.label ?? '').slice(0, 24), value: n(point.value) }))

  if (!data.length) return ''

  const body =
    spec.kind === 'piechart'
      ? pie(data)
      : spec.kind === 'linechart'
        ? line(data, spec.color)
        : bars(data, spec.color)

  const title = spec.title?.trim()
    ? `<text x="${CHART_W / 2}" y="52" text-anchor="middle" font-family="${FONT}" font-size="34" fill="${INK}">${esc(spec.title.slice(0, 60))}</text>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_W}" height="${CHART_H}" viewBox="0 0 ${CHART_W} ${CHART_H}">
${title}
${body}
</svg>`
}

/** Plot area, leaving room for the title, the axis labels and the values. */
const PAD = { top: 90, right: 40, bottom: 96, left: 84 }
const PLOT_W = CHART_W - PAD.left - PAD.right
const PLOT_H = CHART_H - PAD.top - PAD.bottom

/** The axis pair every cartesian chart sits on. */
function axes() {
  const y = PAD.top + PLOT_H
  return `<path d="M ${PAD.left} ${PAD.top} L ${PAD.left} ${y} L ${PAD.left + PLOT_W} ${y}" fill="none" stroke="${RULE}" stroke-width="3" stroke-linecap="round"/>`
}

/** A scale that always includes zero, so bar heights are honest. */
function scale(values: number[]) {
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  const span = max - min || 1
  return {
    max,
    min,
    y: (value: number) => PAD.top + PLOT_H - ((value - min) / span) * PLOT_H,
  }
}

function labels(data: ChartPoint[], step: number, offset: number) {
  const y = PAD.top + PLOT_H + 34
  return data
    .map((point, i) => {
      const x = PAD.left + offset + i * step
      return `<text x="${x.toFixed(1)}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="21" fill="${INK}">${esc(point.label)}</text>`
    })
    .join('\n')
}

function bars(data: ChartPoint[], color: string) {
  const s = scale(data.map((point) => point.value))
  const step = PLOT_W / data.length
  const width = Math.min(96, step * 0.62)
  const zero = s.y(0)

  const rects = data
    .map((point, i) => {
      const x = PAD.left + step * (i + 0.5) - width / 2
      const y = s.y(point.value)
      const top = Math.min(y, zero)
      const height = Math.max(2, Math.abs(zero - y))
      return `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" fill="${color}" opacity="0.85" rx="4"/>
<text x="${(x + width / 2).toFixed(1)}" y="${(top - 12).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="22" fill="${INK}">${esc(pretty(point.value))}</text>`
    })
    .join('\n')

  return `${axes()}\n${rects}\n${labels(data, step, step / 2)}`
}

function line(data: ChartPoint[], color: string) {
  const s = scale(data.map((point) => point.value))
  const step = data.length > 1 ? PLOT_W / (data.length - 1) : 0
  const points = data.map((point, i) => ({
    x: PAD.left + (data.length > 1 ? i * step : PLOT_W / 2),
    y: s.y(point.value),
  }))

  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const dots = points
    .map(
      (p, i) =>
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="7" fill="${color}"/>
<text x="${p.x.toFixed(1)}" y="${(p.y - 18).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="20" fill="${INK}">${esc(pretty(data[i].value))}</text>`
    )
    .join('\n')

  return `${axes()}
<path d="${path}" fill="none" stroke="${color}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
${dots}
${labels(data, data.length > 1 ? step : 0, data.length > 1 ? 0 : PLOT_W / 2)}`
}

/** Slice fills, so neighbouring wedges stay distinguishable. */
const WEDGES = ['#4263eb', '#099268', '#f76707', '#7048e8', '#e03131', '#f0b429', '#4dabf7', '#40c057']

function pie(data: ChartPoint[]) {
  const values = data.map((point) => Math.max(0, point.value))
  const total = values.reduce((sum, value) => sum + value, 0)
  if (!total) return ''

  const cx = 300
  const cy = PAD.top + PLOT_H / 2
  const r = Math.min(PLOT_H, 400) / 2

  let angle = -Math.PI / 2
  const slices = values
    .map((value, i) => {
      const sweep = (value / total) * Math.PI * 2
      const end = angle + sweep
      const x0 = cx + Math.cos(angle) * r
      const y0 = cy + Math.sin(angle) * r
      const x1 = cx + Math.cos(end) * r
      const y1 = cy + Math.sin(end) * r
      const large = sweep > Math.PI ? 1 : 0
      angle = end

      // A single-slice pie is a full circle, which an arc path cannot express.
      const d =
        values.length === 1
          ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
          : `M ${cx} ${cy} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`

      return `<path d="${d}" fill="${WEDGES[i % WEDGES.length]}" opacity="0.88" stroke="#ffffff" stroke-width="3"/>`
    })
    .join('\n')

  // A key, rather than labels crowded onto the slices.
  const key = data
    .map((point, i) => {
      const y = cy - (data.length * 40) / 2 + i * 40
      const share = Math.round((values[i] / total) * 100)
      return `<rect x="600" y="${y - 18}" width="26" height="26" rx="5" fill="${WEDGES[i % WEDGES.length]}"/>
<text x="640" y="${y + 3}" font-family="${FONT}" font-size="22" fill="${INK}">${esc(point.label)} — ${share}%</text>`
    })
    .join('\n')

  return `${slices}\n${key}`
}
