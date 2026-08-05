import { isFetchableUrl } from './image-signing'

/**
 * Image search, behind one interface.
 *
 * Two providers, because SerpApi's free tier is a few hundred searches and a
 * single lesson spends a dozen of them — when it runs dry every lookup 502s and
 * the board silently falls back to dashed placeholders. Google's Custom Search
 * JSON API gives 100 free queries a day on its own key, so it takes over as the
 * default the moment it is configured.
 */
export type Provider = 'google' | 'serpapi'

export interface Candidate {
  /** The full-size image itself. */
  url: string
  width: number
  height: number
  /** The page the image sits on, for attribution and for stock-site filtering. */
  source: string
}

export class ImageSearchError extends Error {
  constructor(
    message: string,
    /** What to send the client: 501 when unconfigured, 502 when upstream failed. */
    readonly status: number
  ) {
    super(message)
  }
}

export function googleKey() {
  return process.env.GOOGLE_CSE_KEY ?? process.env.GOOGLE_API_KEY
}

/** The engine id from a Programmable Search Engine — Google needs both halves. */
export function googleEngineId() {
  return process.env.GOOGLE_CSE_ID ?? process.env.GOOGLE_CSE_CX
}

/**
 * Which provider a search will use. Google first: it is the one with quota
 * left. `IMAGE_PROVIDER` pins it explicitly for testing either side.
 */
export function activeProvider(): Provider | null {
  const pinned = process.env.IMAGE_PROVIDER?.trim().toLowerCase()
  if (pinned === 'google') return googleKey() && googleEngineId() ? 'google' : null
  if (pinned === 'serpapi') return process.env.SERPAPI_KEY ? 'serpapi' : null

  if (googleKey() && googleEngineId()) return 'google'
  if (process.env.SERPAPI_KEY) return 'serpapi'
  return null
}

/**
 * Searches for images and returns raw candidates, newest-first as the provider
 * ranked them. Filtering and picking is the caller's job, so both providers are
 * judged by the same rules.
 */
export async function searchImages(
  query: string,
  wantsMotion: boolean
): Promise<{ provider: Provider; candidates: Candidate[] }> {
  const provider = activeProvider()
  if (!provider) {
    throw new ImageSearchError(
      'No image search configured. Set GOOGLE_CSE_KEY and GOOGLE_CSE_ID, or SERPAPI_KEY.',
      501
    )
  }

  const candidates =
    provider === 'google'
      ? await searchGoogle(query, wantsMotion)
      : await searchSerpApi(query, wantsMotion)

  return { provider, candidates }
}

interface GoogleItem {
  link?: string
  mime?: string
  displayLink?: string
  image?: { width?: number; height?: number; contextLink?: string }
}

async function searchGoogle(query: string, wantsMotion: boolean): Promise<Candidate[]> {
  const params = new URLSearchParams({
    key: googleKey()!,
    cx: googleEngineId()!,
    q: query.slice(0, 200),
    searchType: 'image',
    // Photographs, not schematics: for technical topics the unfiltered top
    // results are cutaway diagrams, which the designed slides already do better.
    imgType: wantsMotion ? 'animated' : 'photo',
    imgSize: 'large',
    safe: 'active',
    // Google's hard cap for one page. SerpApi returns 20; the extra candidates
    // only matter as fallbacks after filtering, so 10 is enough.
    num: '10',
  })
  if (wantsMotion) params.set('fileType', 'gif')

  let response: Response
  try {
    response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
      signal: AbortSignal.timeout(12000),
    })
  } catch (error) {
    console.error('[image] google request failed', error)
    throw new ImageSearchError('Image search failed.', 502)
  }

  const data = (await response.json().catch(() => null)) as {
    items?: GoogleItem[]
    error?: { message?: string; errors?: { reason?: string }[] }
  } | null

  if (!response.ok || data?.error) {
    const reason = data?.error?.errors?.[0]?.reason
    const message = data?.error?.message ?? `HTTP ${response.status}`
    console.error('[image] google', response.status, reason ?? '', message)

    // Quota is the failure worth naming: it is the one that will happen, and
    // it looks exactly like a broken key unless we say so.
    if (response.status === 429 || reason === 'rateLimitExceeded') {
      throw new ImageSearchError('Image search quota exhausted for today.', 502)
    }
    if (response.status === 403) {
      throw new ImageSearchError(`Image search rejected the key: ${message}`, 502)
    }
    throw new ImageSearchError('Image search failed.', 502)
  }

  return (data?.items ?? []).map((item) => ({
    url: item.link ?? '',
    width: item.image?.width ?? 0,
    height: item.image?.height ?? 0,
    source: item.displayLink ?? item.image?.contextLink ?? '',
  }))
}

interface SerpImage {
  original?: string
  original_width?: number
  original_height?: number
  source?: string
}

async function searchSerpApi(query: string, wantsMotion: boolean): Promise<Candidate[]> {
  const params = new URLSearchParams({
    engine: 'google_images',
    q: query.slice(0, 200),
    api_key: process.env.SERPAPI_KEY!,
    tbs: wantsMotion ? 'itp:animated' : 'itp:photo',
    safe: 'active',
    num: '20',
  })

  let response: Response
  try {
    response = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(12000),
    })
  } catch (error) {
    console.error('[image] serpapi request failed', error)
    throw new ImageSearchError('Image search failed.', 502)
  }

  const data = (await response.json().catch(() => null)) as {
    images_results?: SerpImage[]
    error?: string
  } | null

  if (!response.ok || data?.error) {
    console.error('[image] serpapi', response.status, data?.error ?? '')
    if (data?.error?.includes('run out of searches')) {
      throw new ImageSearchError('SerpApi account has run out of searches.', 502)
    }
    throw new ImageSearchError('Image search failed.', 502)
  }

  return (data?.images_results ?? []).map((item) => ({
    url: item.original ?? '',
    width: item.original_width ?? 0,
    height: item.original_height ?? 0,
    source: item.source ?? '',
  }))
}

/** Ignore results that are tiny, enormous, or the wrong shape for a board. */
const MIN_EDGE = 200
const MAX_EDGE = 4000

export function isUsable(item: Candidate) {
  if (!item.url || !isFetchableUrl(item.url)) return false
  if (item.width < MIN_EDGE || item.height < MIN_EDGE) return false
  if (item.width > MAX_EDGE || item.height > MAX_EDGE) return false

  // Extreme aspect ratios are usually banners or sprite sheets.
  const ratio = item.width / item.height
  return ratio > 0.3 && ratio < 3.4
}

/** Watermarking stock sites ruin a board; prefer anything else that passes. */
export function isStock(item: Candidate) {
  return /alamy|shutterstock|dreamstime|istock|getty|123rf|depositphotos|bigstock/i.test(
    `${item.source} ${item.url}`
  )
}

/**
 * Hosts that reliably serve images to third parties. Others frequently return a
 * "no permission to access this content" page instead — which has an image
 * content-type, so nothing downstream can tell it apart from the real thing.
 * Ranking these first is the cheapest defence.
 */
export function isPermissive(item: Candidate) {
  return /wikimedia|wikipedia|nasa\.gov|\.gov\b|\.edu\b|unsplash|pexels|pixabay|flickr|githubusercontent|nih\.gov|noaa\.gov|esa\.int/i.test(
    item.url
  )
}

/** The one image a board should get: permissive and non-stock if possible. */
export function pick(candidates: Candidate[]) {
  return (
    candidates.find((item) => isUsable(item) && !isStock(item) && isPermissive(item)) ??
    candidates.find((item) => isUsable(item) && !isStock(item)) ??
    candidates.find(isUsable) ??
    null
  )
}

/** A query asking for motion gets an animated-only search. */
export function wantsMotion(query: string) {
  return /\b(gif|animated|animation|loop)\b/i.test(query)
}
