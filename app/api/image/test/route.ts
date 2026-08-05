import { signImageUrl } from '@/lib/image-signing'
import {
  activeProvider,
  googleEngineId,
  providerChain,
  googleKey,
  isPermissive,
  isStock,
  isUsable,
  ImageSearchError,
  pick,
  searchImages,
  wantsMotion,
  type Candidate,
} from '@/lib/image-search'

export const maxDuration = 60

/**
 * A diagnostic for the image pipeline.
 *
 * `/api/image/test?q=refrigerator` reports which provider ran, every candidate
 * it returned with the verdict on each, and whether the picked one actually
 * survives the proxy — the three places a lookup can quietly die. Add `&html=1`
 * to see the pictures instead of reading JSON.
 *
 * Worth having because the failure mode is invisible: the board draws a dashed
 * placeholder whether the key is wrong, the quota is spent, or the host blocked
 * the fetch, and all three look identical on screen.
 */
export async function GET(request: Request) {
  // It spends real quota, so it stays a development tool unless opted in.
  if (process.env.NODE_ENV === 'production' && process.env.IMAGE_TEST_ROUTE !== '1') {
    return Response.json({ error: 'Not enabled.' }, { status: 404 })
  }

  const params = new URL(request.url).searchParams
  const query = params.get('q')?.trim() || 'red apple'
  const asHtml = params.get('html') === '1'

  const config = {
    /** Tried in this order until one answers. */
    chain: providerChain(),
    pinned: process.env.IMAGE_PROVIDER ?? null,
    // Presence only — never the values.
    googleKey: Boolean(googleKey()),
    googleEngineId: Boolean(googleEngineId()),
    serpApiKey: Boolean(process.env.SERPAPI_KEY),
  }

  if (!activeProvider()) {
    return respond(
      {
        query,
        config,
        error: 'No image search available.',
        hint: 'IMAGE_PROVIDER pins a provider that is not configured. Clear it to fall back to the keyless sources.',
      },
      asHtml,
      501
    )
  }

  const motion = wantsMotion(query)
  let candidates: Candidate[]
  let served: string
  try {
    const result = await searchImages(query, motion)
    candidates = result.candidates
    served = result.provider
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed.'
    const status = error instanceof ImageSearchError ? error.status : 502
    return respond({ query, config, motion, error: message }, asHtml, status)
  }

  const picked = pick(candidates)

  const results = candidates.map((item) => ({
    ...item,
    proxy: proxyFor(item.url),
    usable: isUsable(item),
    stock: isStock(item),
    permissive: isPermissive(item),
    picked: item === picked,
  }))

  // The search succeeding proves nothing about the picture arriving: hotlink
  // protection and dead URLs both fail here and only here.
  const fetched = picked ? await checkProxy(request, proxyFor(picked.url)) : null

  return respond(
    {
      query,
      config,
      motion,
      // Which one actually answered — not necessarily the first in the chain.
      served,
      returned: candidates.length,
      usable: results.filter((r) => r.usable).length,
      picked: picked ? { ...picked, proxy: proxyFor(picked.url) } : null,
      fetched,
      results,
    },
    asHtml
  )
}

function proxyFor(url: string) {
  return `/api/image/proxy?u=${encodeURIComponent(url)}&s=${signImageUrl(url)}`
}

/** Pulls the picked image through our own proxy and reports what came back. */
async function checkProxy(request: Request, path: string) {
  try {
    const response = await fetch(new URL(path, request.url), {
      signal: AbortSignal.timeout(20000),
    })
    const bytes = response.ok ? (await response.arrayBuffer()).byteLength : 0
    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
      bytes,
      // A few hundred bytes of "image" is a block page, not a photograph.
      looksReal: response.ok && bytes > 2000,
    }
  } catch (error) {
    return { status: 0, error: error instanceof Error ? error.message : 'fetch failed' }
  }
}

type Report = Record<string, unknown> & { results?: { proxy: string; picked: boolean }[] }

function respond(body: Report, asHtml: boolean, status = 200) {
  if (!asHtml) return Response.json(body, { status })

  const cards = (body.results ?? [])
    .map(
      (r) => `<figure${r.picked ? ' class="picked"' : ''}>
      <img src="${escapeHtml(r.proxy)}" loading="lazy" alt="">
      <figcaption>${escapeHtml(summarise(r))}</figcaption>
    </figure>`
    )
    .join('\n')

  // The candidates are shown as pictures below, so keep them out of the dump.
  const summary = { ...body, results: undefined }

  return new Response(
    `<!doctype html><meta charset="utf-8"><title>image search test</title>
<style>
  body{font:14px/1.5 ui-sans-serif,system-ui,sans-serif;margin:24px;color:#18181b}
  pre{background:#f4f4f5;padding:14px;border-radius:10px;overflow:auto}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-top:20px}
  figure{margin:0;border:1px solid #e4e4e7;border-radius:10px;overflow:hidden}
  figure.picked{border:2px solid #16a34a}
  img{display:block;width:100%;height:150px;object-fit:cover;background:#fafafa}
  figcaption{padding:8px;font-size:12px;color:#52525b}
</style>
<h1>image search test</h1>
<pre>${escapeHtml(JSON.stringify(summary, null, 2))}</pre>
<div class="grid">${cards}</div>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } }
  )
}

function summarise(r: Record<string, unknown>) {
  const flags = [
    r.picked ? 'PICKED' : null,
    r.usable ? null : 'unusable',
    r.stock ? 'stock' : null,
    r.permissive ? 'permissive' : null,
  ].filter(Boolean)
  return `${r.width}×${r.height} · ${r.source} ${flags.length ? `· ${flags.join(' ')}` : ''}`
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )
}
