import { isFetchableUrl, signImageUrl } from '@/lib/image-signing'

export const maxDuration = 60

/** Ignore results that are tiny, enormous, or the wrong shape for a board. */
const MIN_EDGE = 200
const MAX_EDGE = 4000

export interface ImageResult {
  /** Same-origin proxy URL, safe to use directly as an <img> src. */
  src: string
  width: number
  height: number
  /** Site the image came from, for attribution. */
  source: string
  /** True for GIFs, so the canvas knows to let them play. */
  animated: boolean
}

interface SerpImage {
  original?: string
  original_width?: number
  original_height?: number
  thumbnail?: string
  source?: string
  title?: string
}

/**
 * Finds one image for a board. Returns 404 rather than an error when nothing
 * suitable turns up, so the player can fall back to drawing a placeholder
 * instead of failing the scene.
 */
export async function GET(request: Request) {
  const apiKey = process.env.SERPAPI_KEY
  if (!apiKey) {
    return Response.json({ error: 'SERPAPI_KEY is not set.' }, { status: 501 })
  }

  const query = new URL(request.url).searchParams.get('q')?.trim()
  if (!query) {
    return Response.json({ error: 'Missing query.' }, { status: 400 })
  }

  // A query asking for motion gets an animated-only search, so "gif" in the
  // model's query actually produces something that moves.
  const wantsMotion = /\b(gif|animated|animation|loop)\b/i.test(query)

  const params = new URLSearchParams({
    engine: 'google_images',
    q: query.slice(0, 200),
    api_key: apiKey,
    // Google's own type filter. Asking for "photograph" in the query is not
    // enough — for technical topics the top results are still cutaway diagrams
    // and schematics, which is exactly what the designed slides already do
    // better. itp:photo restricts to actual photographs.
    tbs: wantsMotion ? 'itp:animated' : 'itp:photo',
    // Diagrams and photographs read better on a whiteboard than screenshots of
    // text, and safe search keeps a classroom tool classroom-safe.
    safe: 'active',
    num: '20',
  })

  let results: SerpImage[]
  try {
    const response = await fetch(`https://serpapi.com/search.json?${params}`)
    if (!response.ok) {
      console.error('[image] serpapi', response.status)
      return Response.json({ error: 'Image search failed.' }, { status: 502 })
    }
    const data = (await response.json()) as { images_results?: SerpImage[]; error?: string }
    if (data.error) {
      console.error('[image] serpapi', data.error)
      return Response.json({ error: 'Image search failed.' }, { status: 502 })
    }
    results = data.images_results ?? []
  } catch (error) {
    console.error('[image] serpapi request failed', error)
    return Response.json({ error: 'Image search failed.' }, { status: 502 })
  }

  // Watermarking stock sites ruin a slide; prefer anything else that passes.
  const isStock = (item: SerpImage) =>
    /alamy|shutterstock|dreamstime|istock|getty|123rf|depositphotos|bigstock/i.test(
      `${item.source ?? ''} ${item.original ?? ''}`
    )

  // Hosts that reliably serve images to third parties. Others frequently
  // return a "no permission to access this content" page instead — which has
  // an image content-type, so nothing downstream can tell it apart from the
  // real thing. Ranking these first is the cheapest defence.
  const isPermissive = (item: SerpImage) =>
    /wikimedia|wikipedia|nasa\.gov|\.gov\b|\.edu\b|unsplash|pexels|pixabay|flickr|githubusercontent|nih\.gov|noaa\.gov|esa\.int/i.test(
      item.original ?? ''
    )

  const usable = (item: SerpImage) => {
    const url = item.original
    if (!url || !isFetchableUrl(url)) return false

    const w = item.original_width ?? 0
    const h = item.original_height ?? 0
    if (w < MIN_EDGE || h < MIN_EDGE || w > MAX_EDGE || h > MAX_EDGE) return false

    // Extreme aspect ratios are usually banners or sprite sheets.
    const ratio = w / h
    return ratio > 0.3 && ratio < 3.4
  }

  const picked =
    results.find((item) => usable(item) && !isStock(item) && isPermissive(item)) ??
    results.find((item) => usable(item) && !isStock(item)) ??
    results.find(usable)

  if (!picked?.original) {
    return Response.json({ error: 'No usable image found.' }, { status: 404 })
  }

  const url = picked.original
  const proxied = `/api/image/proxy?u=${encodeURIComponent(url)}&s=${signImageUrl(url)}`

  return Response.json(
    {
      src: proxied,
      width: picked.original_width ?? 800,
      height: picked.original_height ?? 600,
      source: picked.source ?? '',
      animated: wantsMotion || /\.gif(\?|$)/i.test(url),
    } satisfies ImageResult,
    { headers: { 'cache-control': 'public, max-age=3600' } }
  )
}
