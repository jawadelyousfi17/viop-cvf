import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { CHART_H, CHART_KINDS, CHART_W, chartToSvg, type ChartKind } from '@/lib/chart'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Rendered charts, by a hash of their spec. A lesson replays and skips scenes
 * constantly, and re-rasterising the same chart each time is pure waste.
 */
const cache = new Map<string, Buffer>()
const MAX_CACHED = 120

/**
 * Renders a chart to PNG.
 *
 * The board gets one flat image instead of a pile of tldraw shapes it would
 * have to position itself — which is what put bar labels on top of their bars.
 * Layout inside the chart is the chart's own problem, and it is solved once
 * here rather than guessed at by the model every time.
 */
export async function POST(request: Request) {
  let body: { kind?: string; title?: string; color?: string; data?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const kind = (CHART_KINDS as readonly string[]).includes(body.kind ?? '')
    ? (body.kind as ChartKind)
    : 'barchart'

  const data = Array.isArray(body.data)
    ? (body.data as { label?: unknown; value?: unknown }[])
        .filter((point) => point && Number.isFinite(Number(point.value)))
        .slice(0, 12)
        .map((point) => ({ label: String(point.label ?? ''), value: Number(point.value) }))
    : []

  if (!data.length) return Response.json({ error: 'No data to chart.' }, { status: 400 })

  const spec = {
    kind,
    title: String(body.title ?? '').slice(0, 60),
    // Only a hex colour ever reaches the SVG, so a colour can't carry markup.
    color: /^#[0-9a-fA-F]{6}$/.test(String(body.color)) ? String(body.color) : '#4263eb',
    data,
  }

  const id = createHash('sha256').update(JSON.stringify(spec)).digest('hex').slice(0, 32)
  if (!cache.has(id)) {
    const svg = chartToSvg(spec)
    if (!svg) return Response.json({ error: 'Nothing to draw.' }, { status: 400 })

    try {
      const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 6 }).toBuffer()
      // Oldest out first — a session only ever looks back a few charts.
      if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!)
      cache.set(id, png)
    } catch (error) {
      console.error('[chart] rasterise failed', error)
      return Response.json({ error: 'Could not render the chart.' }, { status: 500 })
    }
  }

  return Response.json({ id, url: `/api/chart?v=${id}`, width: CHART_W, height: CHART_H })
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('v')
  const png = id ? cache.get(id) : null
  if (!png) return new Response('Not rendered', { status: 404 })

  return new Response(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'private, max-age=3600',
      'content-length': String(png.length),
    },
  })
}
