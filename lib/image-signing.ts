import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The image proxy only serves URLs that our own search route handed out.
 *
 * Without this the proxy is an open relay: anyone could point it at an internal
 * address and read the response through our server. Signing means an attacker
 * can't mint a URL we'll fetch.
 */
function secret() {
  const value = process.env.IMAGE_PROXY_SECRET ?? process.env.SERPAPI_KEY
  if (!value) throw new Error('No secret available for signing image URLs')
  return value
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
