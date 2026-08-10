import OpenAI from 'openai'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ImageResult } from '../image/route'
import { requireIdentity } from '@/lib/owner'

export const maxDuration = 60

/**
 * Symbols the marketing demos draw, which have to work signed out.
 *
 * The wall covers every route that spends money, and this one does — so the
 * landing page's demo was quietly getting 401s and rendering a map with no
 * pictures on it, to exactly the audience the page exists for. An allowlist
 * rather than an exception for the whole route: these few terms may be drawn
 * for anyone, everything else still needs an account. Each is drawn once, ever,
 * and served from disk afterwards.
 */
const PUBLIC = new Set(['magnet', 'staircase', 'hourglass', 'stopwatch', 'ladder', 'brain'])

/**
 * Draws one line-art symbol for a board — with the OpenAI API, not an icon
 * library. The model writes a handful of SVG strokes for the term; we wrap
 * them in the house hand-drawn style (rough displacement, round caps, one ink)
 * and hand the result to the player as a data URL.
 *
 * The response keeps the exact shape of `/api/image`, so a symbol still
 * travels through the player on the path a photograph does. Every generated
 * symbol is cached on disk — a term is drawn once, ever.
 */

/**
 * Where drawn symbols are kept.
 *
 * Not in the project directory when there is no project directory to write to.
 * A serverless filesystem is read-only apart from /tmp, so `mkdir` under
 * `process.cwd()` throws EROFS on every symbol — and that write used to sit
 * inside a `catch` block with nothing around it, so the throw escaped the
 * handler, the route answered 500, and after six of those the client switched
 * symbols off for the rest of the session. Every board came out as boxes and
 * lettering, having paid the model to draw the pictures first.
 *
 * /tmp survives for the life of the instance and no longer, which is the right
 * lifetime anyway: the disk cache is a way of not redrawing the same term
 * twice, not a store.
 */
const CACHE_DIR = process.env.VERCEL
  ? join(tmpdir(), 'nipsol-icons')
  : join(process.cwd(), '.cache', 'icons')
const memo = new Map<string, string | null>()

const SYSTEM = `You draw minimal line icons as SVG strokes.

Rules — all of them matter:
- Reply with ONLY SVG drawing elements: <path>, <circle>, <rect>, <line>, <polyline>, <ellipse>. No <svg> wrapper, no markdown, no prose.
- The canvas is a 48×48 viewBox. The drawing must FILL it: its bounding box spans roughly x=4..44, y=4..44, centred.
- 2 to 6 elements. Simple, iconic, instantly readable — what a person would sketch on a whiteboard in five seconds.
- Line art only: no fill attributes, no stroke attributes, no colours, no text, no defs, no transforms. Geometry only.

Example — Draw: database
<ellipse cx="24" cy="10" rx="18" ry="6"/><path d="M6 10v28c0 3.3 8 6 18 6s18-2.7 18-6V10"/><path d="M6 24c0 3.3 8 6 18 6s18-2.7 18-6"/>

Example — Draw: envelope
<rect x="5" y="10" width="38" height="28" rx="2"/><path d="M5 12l19 14 19-14"/>`

function wrap(art: string, seed: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="-4 -4 56 56">` +
    `<filter id="w" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="${seed}"/>` +
    `<feDisplacementMap in="SourceGraphic" scale="2.6"/></filter>` +
    `<g filter="url(#w)" fill="none" stroke="#1c1a17" stroke-width="2.6" ` +
    `stroke-linecap="round" stroke-linejoin="round">${art}</g></svg>`
  )
}

/** Keeps only plain geometry: the model's job is shapes, nothing else. */
function sanitize(reply: string): string | null {
  const art = reply
    .replace(/```(?:svg|xml|html)?/g, '')
    .replace(/<\/?svg[^>]*>/gi, '')
    .trim()
  if (!art || /<\s*(script|image|foreignObject|use|iframe|a|text|style|defs)\b/i.test(art)) return null
  if (/\bon[a-z]+\s*=/i.test(art) || /href/i.test(art)) return null
  if (!/<(path|circle|rect|line|polyline|ellipse)\b/i.test(art)) return null
  // One ink, no fills — the wrapper decides how the strokes look.
  return art.replace(/\s(?:fill|stroke|stroke-width|style|class)="[^"]*"/gi, '')
}

async function draw(query: string): Promise<string | null> {
  const client = new OpenAI()
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_ICON_MODEL ?? 'gpt-5.6-luna',
    // The 5.6 family fixes temperature and renamed the token cap.
    max_completion_tokens: 2_000,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Draw: ${query}` },
    ],
  })
  const art = sanitize(response.choices[0]?.message?.content ?? '')
  if (!art) return null
  const seed = createHash('md5').update(query).digest()[0]
  return wrap(art, seed)
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim()
  if (!query) return Response.json({ error: 'Missing query.' }, { status: 400 })

  // The wall lets this route through so the landing page's demo can draw; the
  // route decides what a stranger may ask for. Anything outside the demo's own
  // handful of terms still needs an account.
  if (!PUBLIC.has(query.toLowerCase()) && !(await requireIdentity())) {
    return Response.json({ error: 'Sign in first.' }, { status: 401 })
  }
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'No OPENAI_API_KEY configured.' }, { status: 501 })
  }

  const key = createHash('md5').update(query.toLowerCase()).digest('hex')

  let svg = memo.get(key)
  if (svg === undefined) {
    // Disk first: a term is drawn once, ever.
    try {
      svg = await readFile(join(CACHE_DIR, `${key}.svg`), 'utf8')
    } catch {
      try {
        svg = await draw(query)
      } catch (error) {
        console.error('[icon] generation failed', error)
        return Response.json({ error: 'Could not draw the symbol.' }, { status: 502 })
      }
      // Best effort, always. A symbol that cannot be filed is still a symbol,
      // and failing to cache it must never cost the caller the drawing.
      if (svg) {
        try {
          await mkdir(CACHE_DIR, { recursive: true })
          await writeFile(join(CACHE_DIR, `${key}.svg`), svg)
        } catch (error) {
          console.warn('[icon] could not cache to disk', error)
        }
      }
    }
    memo.set(key, svg ?? null)
  }

  if (!svg) return Response.json({ error: 'No symbol came out.' }, { status: 404 })

  const result: ImageResult = {
    src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    width: 200,
    height: 200,
    source: 'drawn by the model',
    animated: false,
  }
  return Response.json(result, { headers: { 'cache-control': 'no-store' } })
}
