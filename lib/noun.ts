import { createHmac, randomBytes } from 'node:crypto'

/**
 * Line-art symbols from The Noun Project.
 *
 * The board could already fetch a photograph and draw an emoji, and neither is
 * quite the thing you want for "show me a router". A photograph of a router is
 * a black box with lights on it; the emoji set has no router at all. A symbol
 * is the third register — a drawn glyph for an abstract or technical thing,
 * which is most of what a systems lesson is about.
 *
 * The API is OAuth 1.0a, which is why this file exists rather than a fetch
 * call at the point of use: the signature has to be computed over a normalised
 * form of the request, and getting that subtly wrong fails with a 401 that
 * says nothing about why.
 */

const API = 'https://api.thenounproject.com/v2/icon'

export interface NounIcon {
  id: string
  /** PNG, transparent background, 200px on its longest side. */
  url: string
  term: string
  /** Required by the licence for anything but public-domain icons. */
  attribution: string
  license: string
}

export class NounError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** RFC 5849 percent-encoding, which is stricter than encodeURIComponent. */
function enc(value: string) {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (char) => '%' + char.charCodeAt(0).toString(16).toUpperCase()
  )
}

/**
 * The `Authorization` header for a signed GET.
 *
 * Every parameter — query string and OAuth alike — goes into the signature
 * base, sorted, which is the part that is easy to get wrong: signing only the
 * OAuth fields produces a valid-looking header that the server rejects.
 */
function authorize(url: string, params: Record<string, string>, key: string, secret: string) {
  const oauth: Record<string, string> = {
    oauth_consumer_key: key,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: '1.0',
  }

  const all = { ...params, ...oauth }
  const normalised = Object.keys(all)
    .sort()
    .map((name) => `${enc(name)}=${enc(all[name])}`)
    .join('&')

  const base = ['GET', enc(url), enc(normalised)].join('&')
  const signature = createHmac('sha1', `${enc(secret)}&`).update(base).digest('base64')

  return (
    'OAuth ' +
    Object.entries({ ...oauth, oauth_signature: signature })
      .map(([name, value]) => `${enc(name)}="${enc(value)}"`)
      .join(', ')
  )
}

/**
 * How well a result answers the query.
 *
 * The search is fuzzy and ranks by its own popularity, so asking for "router"
 * puts a map "route" at the top with half a dozen actual routers below it.
 * Matching the term is worth more than anything else here: a public-domain
 * icon of the wrong thing is still the wrong thing, so licence only breaks
 * ties between icons that are equally right.
 */
function score(term: string, license: string, wanted: string) {
  const name = term.toLowerCase()
  let points = 0
  if (name === wanted) points += 4
  else if (name.includes(wanted) || wanted.includes(name)) points += 2
  if (/public.domain/i.test(license)) points += 1
  return points
}

/**
 * The best symbol for a query, or null when there isn't one.
 *
 * Among equally good matches, prefers public domain: everything else is
 * Creative Commons Attribution, and a board that has to print a credit line
 * for every glyph on it stops being a board.
 */
export async function findIcon(query: string): Promise<NounIcon | null> {
  const key = process.env.NOUN_PROJECT_KEY
  const secret = process.env.NOUN_PROJECT_SECRET
  if (!key || !secret) throw new NounError('Noun Project keys are not set.', 501)

  const params = { query: query.trim().slice(0, 80), limit: '10' }
  const url = `${API}?${new URLSearchParams(params)}`

  const response = await fetch(url, {
    headers: { Authorization: authorize(API, params, key, secret) },
  })

  if (response.status === 404) return null
  if (!response.ok) {
    throw new NounError(`The Noun Project returned ${response.status}.`, response.status)
  }

  const data = (await response.json()) as {
    icons?: {
      id?: string
      term?: string
      thumbnail_url?: string
      attribution?: string
      license_description?: string
    }[]
  }

  const icons = (data.icons ?? []).filter((icon) => icon.thumbnail_url)
  if (!icons.length) return null

  // Stable sort, so the API's own ranking breaks ties between equal scores.
  const wanted = params.query.toLowerCase()
  const chosen = icons
    .map((icon, rank) => ({ icon, rank, points: score(icon.term ?? '', icon.license_description ?? '', wanted) }))
    .sort((a, b) => b.points - a.points || a.rank - b.rank)[0].icon

  return {
    id: String(chosen.id ?? ''),
    url: chosen.thumbnail_url!,
    term: chosen.term ?? query,
    attribution: chosen.attribution ?? '',
    license: chosen.license_description ?? '',
  }
}
