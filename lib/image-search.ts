import { isFetchableUrl } from './image-signing'

/**
 * Image search, behind one interface.
 *
 * Three of them, because a lesson spends a dozen searches and the paid tiers are
 * small: SerpApi's free allowance is a few hundred total, Google's is 100 a day.
 * When one runs dry every lookup 502s and the board quietly fills with dashed
 * placeholders, which is indistinguishable from a bad key.
 *
 * So the chain always ends in `open` — Openverse and Wikimedia Commons, neither
 * of which needs a key, a Cloud project or a card. Images work with no
 * configuration at all, and a key going quiet mid-lesson costs quality rather
 * than the pictures themselves.
 */
export type Provider = 'google' | 'serpapi' | 'open'

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
    readonly status: number,
    /** True when the provider is out of quota, not merely having a bad moment. */
    readonly exhausted = false
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
 * Providers whose quota is spent, so we stop paying a round trip to be told so
 * again. Process-local and deliberately not persisted: a restart re-checks.
 */
const exhausted = new Set<Provider>()

/**
 * Every provider that could serve a search, best first.
 *
 * The keyless pair is always last but always present, which is what makes the
 * board work with no configuration at all — and what catches a paid key going
 * quiet mid-lesson. `IMAGE_PROVIDER` pins one, disabling the fallthrough.
 */
export function providerChain(): Provider[] {
  const pinned = process.env.IMAGE_PROVIDER?.trim().toLowerCase()
  if (pinned === 'google') return googleKey() && googleEngineId() ? ['google'] : []
  if (pinned === 'serpapi') return process.env.SERPAPI_KEY ? ['serpapi'] : []
  if (pinned === 'open') return ['open']

  const chain: Provider[] = []
  if (googleKey() && googleEngineId()) chain.push('google')
  if (process.env.SERPAPI_KEY) chain.push('serpapi')
  chain.push('open')
  return chain.filter((provider) => !exhausted.has(provider))
}

/** Which provider a search would try first — what the diagnostics report. */
export function activeProvider(): Provider | null {
  return providerChain()[0] ?? null
}

/**
 * Searches for images and returns raw candidates, best first as the provider
 * ranked them. Filtering and picking is the caller's job, so every provider is
 * judged by the same rules.
 *
 * Walks the chain until one answers. A provider that has run out is remembered,
 * because otherwise every lookup for the rest of the session pays for the same
 * refusal — a dozen wasted round trips per scene.
 */
export async function searchImages(
  query: string,
  wantsMotion: boolean
): Promise<{ provider: Provider; candidates: Candidate[] }> {
  const chain = providerChain()
  if (!chain.length) {
    throw new ImageSearchError('No image search available.', 501)
  }

  let last: ImageSearchError | null = null

  for (const provider of chain) {
    try {
      const candidates = await runProvider(provider, query, wantsMotion)
      if (candidates.length) return { provider, candidates }
      // An empty answer isn't a failure — but if someone further down the
      // chain can do better, let them try.
      last = new ImageSearchError('No results.', 404)
    } catch (error) {
      if (!(error instanceof ImageSearchError)) throw error
      last = error
      if (error.exhausted) {
        console.warn(`[image] ${provider} is out of quota — falling through`)
        exhausted.add(provider)
      }
    }
  }

  throw last ?? new ImageSearchError('Image search failed.', 502)
}

function runProvider(provider: Provider, query: string, wantsMotion: boolean) {
  if (provider === 'google') return searchGoogle(query, wantsMotion)
  if (provider === 'serpapi') return searchSerpApi(query, wantsMotion)
  return searchOpen(query, wantsMotion)
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
      throw new ImageSearchError('Image search quota exhausted for today.', 502, true)
    }
    if (response.status === 403) {
      throw new ImageSearchError(`Image search rejected the key: ${message}`, 502, true)
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
      throw new ImageSearchError('SerpApi account has run out of searches.', 502, true)
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

/**
 * Openverse and Wikimedia Commons, asked at the same time and merged.
 *
 * Neither needs a key, a project or a card, so this is the source that always
 * works. They complement each other: Commons is stronger on science, machinery
 * and anything with a diagram, Openverse on everyday objects, since most of it
 * is Flickr. Commons also serves from upload.wikimedia.org, which the ranking
 * already treats as permissive, so its results tend to win the pick.
 */
async function searchOpen(query: string, wantsMotion: boolean): Promise<Candidate[]> {
  const [openverse, commons] = await Promise.all([
    searchOpenverse(query, wantsMotion).catch((error) => {
      console.error('[image] openverse', error)
      return [] as Candidate[]
    }),
    searchCommons(query, wantsMotion).catch((error) => {
      console.error('[image] commons', error)
      return [] as Candidate[]
    }),
  ])

  // Interleaved rather than concatenated: whichever source is better for this
  // particular query gets a shot at the pick without one of them monopolising
  // the front of the list.
  const merged: Candidate[] = []
  for (let i = 0; i < Math.max(openverse.length, commons.length); i++) {
    if (commons[i]) merged.push(commons[i])
    if (openverse[i]) merged.push(openverse[i])
  }
  return merged
}

interface OpenverseImage {
  url?: string
  width?: number
  height?: number
  source?: string
  mature?: boolean
}

async function searchOpenverse(query: string, wantsMotion: boolean): Promise<Candidate[]> {
  const params = new URLSearchParams({
    q: query.slice(0, 200),
    page_size: '20',
    // Anything reusable. The board shows a photograph for a few seconds in a
    // teaching context, but there is no reason to reach for the restrictive end.
    license_type: 'all',
    mature: 'false',
  })
  if (wantsMotion) params.set('extension', 'gif')

  const response = await fetch(`https://api.openverse.org/v1/images/?${params}`, {
    headers: { 'user-agent': UA },
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) return []

  const data = (await response.json()) as { results?: OpenverseImage[] }
  return (data.results ?? [])
    .filter((item) => !item.mature)
    .map((item) => ({
      url: item.url ?? '',
      width: item.width ?? 0,
      height: item.height ?? 0,
      source: item.source ?? 'openverse',
    }))
}

interface CommonsInfo {
  url?: string
  width?: number
  height?: number
  mime?: string
  /** Present because we asked for iiurlwidth — a scaled copy, not the scan. */
  thumburl?: string
  thumbwidth?: number
  thumbheight?: number
}

interface CommonsPage {
  imageinfo?: CommonsInfo[]
}

async function searchCommons(query: string, wantsMotion: boolean): Promise<Candidate[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    // namespace 6 is File:. Restricting the type here rather than filtering
    // after keeps PDFs, audio and video out of the twenty we get back.
    gsrsearch: `filemime:${wantsMotion ? 'image/gif' : 'image/jpeg'} ${query.slice(0, 200)}`,
    gsrnamespace: '6',
    gsrlimit: '20',
    prop: 'imageinfo',
    iiprop: 'url|size|mime',
    // Ask for a board-sized copy rather than the 3000px original: Commons
    // scans can be tens of megabytes, which the proxy would refuse anyway.
    iiurlwidth: '1200',
  })

  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { 'user-agent': UA },
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) return []

  const data = (await response.json()) as { query?: { pages?: Record<string, CommonsPage> } }

  return Object.values(data.query?.pages ?? {})
    .map((page) => page.imageinfo?.[0])
    .filter((info): info is CommonsInfo => Boolean(info?.url))
    .map((info) => ({
      // The scaled copy when Commons made one. Originals here are museum scans
      // — tens of megabytes, well past what the proxy will pass through, and
      // pointless for a shape a few hundred pixels wide.
      url: info.thumburl ?? info.url!,
      width: info.thumburl ? (info.thumbwidth ?? 0) : (info.width ?? 0),
      height: info.thumburl ? (info.thumbheight ?? 0) : (info.height ?? 0),
      source: 'commons.wikimedia.org',
    }))
}

/** Wikimedia blocks unidentified clients, and it is polite besides. */
const UA = 'viop/1.0 (teaching tool; https://github.com/jel-yous/viop)'

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
