import { isFetchableUrl, verifyImageUrl } from '@/lib/image-signing'

export const maxDuration = 60

/** Anything larger than this isn't going on a whiteboard. */
const MAX_BYTES = 12 * 1024 * 1024

/**
 * Serves a remote image same-origin.
 *
 * Two reasons this exists rather than pointing the canvas straight at the
 * original URL: many hosts block hotlinking by Referer, and an https page can't
 * load http images. The signature check means only URLs our own search route
 * produced are ever fetched.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const url = params.get('u')
  const signature = params.get('s')

  if (!url || !signature) {
    return new Response('Missing parameters', { status: 400 })
  }
  if (!verifyImageUrl(url, signature) || !isFetchableUrl(url)) {
    return new Response('Not allowed', { status: 403 })
  }

  let upstream: Response
  try {
    upstream = await fetch(url, {
      headers: {
        // Some CDNs serve a placeholder unless these look like a browser.
        accept: 'image/avif,image/webp,image/png,image/jpeg,image/svg+xml,*/*;q=0.8',
        'user-agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        // Referer from the image's own origin: most hotlink protection checks
        // only that the referer matches, and otherwise returns a block page
        // with an image content-type that looks valid to everything downstream.
        referer: new URL(url).origin + '/',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    return new Response('Upstream fetch failed', { status: 502 })
  }

  const type = upstream.headers.get('content-type') ?? ''
  if (!upstream.ok || !type.startsWith('image/')) {
    return new Response('Not an image', { status: 502 })
  }

  const length = Number(upstream.headers.get('content-length') ?? 0)
  if (length > MAX_BYTES) {
    return new Response('Image too large', { status: 502 })
  }

  const bytes = await upstream.arrayBuffer()
  if (bytes.byteLength > MAX_BYTES) {
    return new Response('Image too large', { status: 502 })
  }

  return new Response(bytes, {
    headers: {
      'content-type': type,
      'cache-control': 'public, max-age=86400, immutable',
      'content-length': String(bytes.byteLength),
    },
  })
}
