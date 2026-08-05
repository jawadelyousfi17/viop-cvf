import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Last-resort signing key, for a setup with no API keys at all — the keyless
 * image providers need signed proxy URLs just as much as the paid ones.
 *
 * Generated once per process, which is fine locally and wrong across several
 * server instances: one would sign a URL another can't verify, and every image
 * would 403. Production wants IMAGE_PROXY_SECRET set explicitly.
 */
let generated: string | null = null

function fallbackSecret() {
  if (!generated) {
    generated = randomBytes(32).toString('hex')
    console.warn(
      '[image] no key to sign proxy URLs with — using a per-process secret. Set IMAGE_PROXY_SECRET before deploying.'
    )
  }
  return generated
}

/**
 * The image proxy only serves URLs that our own search route handed out.
 *
 * Without this the proxy is an open relay: anyone could point it at an internal
 * address and read the response through our server. Signing means an attacker
 * can't mint a URL we'll fetch.
 */
function secret() {
  // Any configured key will do — it only has to be stable and non-public.
  // Falling back through every provider means swapping search backends doesn't
  // silently break signing (and with it every image on the board).
  return (
    process.env.IMAGE_PROXY_SECRET ??
    process.env.GOOGLE_CSE_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.SERPAPI_KEY ??
    fallbackSecret()
  )
}

export function signImageUrl(url: string) {
  return createHmac('sha256', secret()).update(url).digest('hex').slice(0, 32)
}

export function verifyImageUrl(url: string, signature: string) {
  let expected: string
  try {
    expected = signImageUrl(url)
  } catch {
    return false
  }

  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Blocks non-http(s) schemes and anything pointing back at our own network. */
export function isFetchableUrl(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false

  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return false
  }
  // Literal private and loopback ranges. Hostnames that resolve to them are not
  // covered here — the signature is what actually keeps attackers out.
  if (
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]'
  ) {
    return false
  }

  return true
}
