import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { isRenderableManimScene, normalizeManimScene, type ManimScene } from '@/lib/manim-lesson'
import { sceneToPython } from '@/lib/manim-python'

export const runtime = 'nodejs'
export const maxDuration = 300

const run = promisify(execFile)

/** Rendered scenes, keyed by a hash of the script that produced them. */
const CACHE_DIR = join(tmpdir(), 'viop-manim')

/** Quality flag. Low is 480p15 — plenty for a lesson, and several times faster. */
const QUALITY = process.env.MANIM_QUALITY ?? 'l'
const MANIM_BIN = process.env.MANIM_BIN ?? 'manim'
const RENDER_TIMEOUT = Number(process.env.MANIM_TIMEOUT ?? 240_000)

/**
 * Whether the server can render at all, and one cached video by id.
 *
 * The player asks this on startup: with manim installed it plays rendered
 * video, and without it falls back to the browser renderer rather than showing
 * nothing.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('v')
  if (id) return serve(id, request)

  try {
    const { stdout } = await run(MANIM_BIN, ['--version'], { timeout: 15_000 })
    return Response.json({ available: true, version: stdout.trim().split('\n')[0] })
  } catch {
    return Response.json({
      available: false,
      hint: 'manim is not on PATH. Install it, or set MANIM_BIN to its full path.',
    })
  }
}

/** Streams a cached video, honouring range requests so seeking works. */
async function serve(id: string, request: Request) {
  // The id goes into a path, so nothing but a hex digest may pass.
  if (!/^[a-f0-9]{16,64}$/.test(id)) return new Response('Bad id', { status: 400 })

  const file = join(CACHE_DIR, `${id}.mp4`)
  let size: number
  try {
    size = (await stat(file)).size
  } catch {
    return new Response('Not rendered', { status: 404 })
  }

  const bytes = await readFile(file)
  const range = request.headers.get('range')
  const headers: Record<string, string> = {
    'content-type': 'video/mp4',
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=3600',
  }

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range)
    const start = Number(match?.[1] ?? 0)
    const end = match?.[2] ? Number(match[2]) : size - 1
    return new Response(bytes.subarray(start, end + 1), {
      status: 206,
      headers: { ...headers, 'content-range': `bytes ${start}-${end}/${size}` },
    })
  }

  return new Response(bytes, { headers: { ...headers, 'content-length': String(size) } })
}

/**
 * Renders one scene to mp4 and returns its id.
 *
 * The timing is baked into the video, so this runs *after* the scene's
 * voiceover exists — the caller passes the schedule it resolved from the real
 * audio, and every animation lands on the word it belongs to. Identical
 * requests hit the cache, which is what makes replay and scene-skip instant.
 */
export async function POST(request: Request) {
  let body: { scene?: ManimScene; schedule?: Record<string, number>; duration?: number }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const raw = body.scene
  if (!isRenderableManimScene(raw)) {
    return Response.json({ error: 'No scene to render.' }, { status: 400 })
  }

  // Re-normalized here rather than trusted: this input becomes a file the
  // server executes, so it goes through the same clamps as a streamed scene.
  const scene = normalizeManimScene(raw, 0)
  const duration = Number.isFinite(body.duration) ? Math.min(600, Math.max(1, body.duration!)) : 20

  const schedule: Record<string, number> = {}
  for (const step of scene.steps) {
    const at = body.schedule?.[step.id]
    schedule[step.id] = Number.isFinite(at) ? Math.min(duration, Math.max(0, at!)) : step.at * duration
  }

  const source = sceneToPython(scene, { schedule, duration })
  const id = createHash('sha256').update(source).digest('hex').slice(0, 32)
  const output = join(CACHE_DIR, `${id}.mp4`)

  await mkdir(CACHE_DIR, { recursive: true })
  try {
    await stat(output)
    return Response.json({ id, url: `/api/render?v=${id}`, cached: true })
  } catch {
    // Not rendered yet.
  }

  const work = await mkdtemp(join(tmpdir(), 'viop-render-'))
  try {
    const script = join(work, 'scene.py')
    await writeFile(script, source, 'utf8')

    await run(
      MANIM_BIN,
      [
        'render',
        `-q${QUALITY}`,
        '--format=mp4',
        '--media_dir',
        work,
        // Partial-movie caching across runs is what makes manim reuse a stale
        // frame when only the timing changed; every render here is fresh.
        '--disable_caching',
        script,
        'LessonScene',
      ],
      { timeout: RENDER_TIMEOUT, cwd: work, maxBuffer: 8 * 1024 * 1024 }
    )

    const produced = await findVideo(work)
    if (!produced) throw new Error('manim produced no video')

    await writeFile(output, await readFile(produced))
    return Response.json({ id, url: `/api/render?v=${id}`, cached: false })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    // stderr carries the actual Python traceback, which is the only useful
    // thing when a scene fails to build.
    const stderr = (error as { stderr?: string }).stderr
    console.error('[render] manim failed', stderr || detail)
    return Response.json(
      { error: 'Render failed.', detail: (stderr || detail).slice(-1200) },
      { status: 502 }
    )
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {})
  }
}

/** manim buries its output under media/videos/<script>/<quality>/. */
async function findVideo(root: string): Promise<string | null> {
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()!
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        // partial_movie_files holds the per-animation fragments, not the scene.
        if (entry.name !== 'partial_movie_files') stack.push(path)
      } else if (entry.name.endsWith('.mp4')) {
        return path
      }
    }
  }
  return null
}
