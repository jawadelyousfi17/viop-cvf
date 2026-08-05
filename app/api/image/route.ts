import { signImageUrl } from '@/lib/image-signing'
import { ImageSearchError, pick, searchImages, wantsMotion } from '@/lib/image-search'

export const maxDuration = 60

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

/**
 * Finds one image for a board. Returns 404 rather than an error when nothing
 * suitable turns up, so the player can fall back to drawing a placeholder
 * instead of failing the scene.
 *
 * The search itself lives in `lib/image-search.ts`, which picks between Google
 * Custom Search and SerpApi depending on what is configured.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim()
  if (!query) {
    return Response.json({ error: 'Missing query.' }, { status: 400 })
  }

  const motion = wantsMotion(query)

  let candidates
  try {
    ;({ candidates } = await searchImages(query, motion))
  } catch (error) {
    if (error instanceof ImageSearchError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    throw error
  }

  const picked = pick(candidates)
  if (!picked) {
    return Response.json({ error: 'No usable image found.' }, { status: 404 })
  }

  const proxied = `/api/image/proxy?u=${encodeURIComponent(picked.url)}&s=${signImageUrl(picked.url)}`

  return Response.json(
    {
      src: proxied,
      width: picked.width || 800,
      height: picked.height || 600,
      source: picked.source,
      animated: motion || /\.gif(\?|$)/i.test(picked.url),
    } satisfies ImageResult,
    { headers: { 'cache-control': 'public, max-age=3600' } }
  )
}
