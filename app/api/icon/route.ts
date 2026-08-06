import { signImageUrl } from '@/lib/image-signing'
import { findIcon, NounError } from '@/lib/noun'
import type { ImageResult } from '../image/route'

export const maxDuration = 30

/**
 * Finds one line-art symbol for a board.
 *
 * Deliberately returns the same shape as `/api/image`, so a symbol travels
 * through the player on exactly the path a photograph already does — the same
 * proxy, the same cache, the same placeholder-then-swap in the painter. The
 * only thing that differs is where the picture came from.
 */
const cache = new Map<string, ImageResult | null>()
const MAX_CACHED = 300

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim()
  if (!query) return Response.json({ error: 'Missing query.' }, { status: 400 })

  const key = query.toLowerCase()
  if (cache.has(key)) {
    const hit = cache.get(key)!
    return hit
      ? Response.json(hit, { headers: { 'cache-control': 'public, max-age=86400' } })
      : Response.json({ error: 'No symbol found.' }, { status: 404 })
  }

  let icon
  try {
    icon = await findIcon(query)
  } catch (error) {
    if (error instanceof NounError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    throw error
  }

  if (!icon) {
    remember(key, null)
    return Response.json({ error: 'No symbol found.' }, { status: 404 })
  }

  const result: ImageResult = {
    // Through the signed proxy like everything else, so the canvas never talks
    // to a third-party host directly.
    src: signImageUrl(icon.url),
    // The thumbnail is 200px on its longest side; the board scales it to the
    // box the scene gave it, and a symbol is line art, so it takes that well.
    width: 200,
    height: 200,
    source: icon.attribution || 'The Noun Project',
    animated: false,
  }

  remember(key, result)
  return Response.json(result, { headers: { 'cache-control': 'public, max-age=86400' } })
}

function remember(key: string, value: ImageResult | null) {
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!)
  cache.set(key, value)
}
