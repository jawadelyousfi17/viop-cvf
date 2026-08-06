import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { parseScript } from '@/lib/script-import'
import { cacheKey, hasSpeech } from '@/lib/tts-cache'
import { speechIdentity } from '@/lib/tts-identity'
import { DEFAULT_VOICE_ID } from '@/lib/voices'

/**
 * The scripts kept in `scripts/`, so a written lesson can be replayed from the
 * topic screen instead of pasted in again every time.
 *
 * Read from disk on request rather than bundled: a script is content, and
 * editing one should not mean a rebuild.
 */

const DIRECTORY = 'scripts'
const EXTENSIONS = /\.(md|txt)$/i

export interface SavedScript {
  /** Filename without its extension — the id used to fetch it. */
  name: string
  title: string
  scenes: number
  words: number
  /** Scenes whose narration is already recorded, for the requested voice. */
  recorded: number
}

/** The first heading in a script, or its filename tidied up. */
function titleOf(source: string, name: string) {
  const heading = /^#\s+(.+)$/m.exec(source)
  if (heading) return heading[1].replace(/[—-].*$/, '').trim()
  return name.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const wanted = url.searchParams.get('name')
  const voiceId = url.searchParams.get('voice') ?? DEFAULT_VOICE_ID

  if (wanted) {
    // Only ever a bare filename from our own directory: a name carrying a path
    // would otherwise read any file the server can reach.
    const name = basename(wanted).replace(EXTENSIONS, '')
    if (!/^[\w-]+$/.test(name)) {
      return Response.json({ error: 'Unknown script.' }, { status: 400 })
    }

    for (const extension of ['.md', '.txt']) {
      try {
        const text = await readFile(join(DIRECTORY, name + extension), 'utf8')
        return Response.json({ name, text, scenes: parseScript(text).length })
      } catch {
        // Try the other extension before giving up.
      }
    }
    return Response.json({ error: 'Unknown script.' }, { status: 404 })
  }

  let files: string[]
  try {
    files = (await readdir(DIRECTORY)).filter((file) => EXTENSIONS.test(file))
  } catch {
    return Response.json({ scripts: [] })
  }

  const scripts: SavedScript[] = []
  for (const file of files.sort()) {
    try {
      const text = await readFile(join(DIRECTORY, file), 'utf8')
      const parsed = parseScript(text)
      // A file with nothing speakable in it is a note, not a script.
      if (!parsed.length) continue
      const name = file.replace(EXTENSIONS, '')
      const { provider, voice, model } = speechIdentity(voiceId)
      const recorded = (
        await Promise.all(
          parsed.map((scene) =>
            hasSpeech(cacheKey({ text: scene.narration.trim(), provider, voice, model }))
          )
        )
      ).filter(Boolean).length

      scripts.push({
        name,
        title: titleOf(text, name),
        scenes: parsed.length,
        words: parsed.reduce((sum, scene) => sum + scene.words, 0),
        recorded,
      })
    } catch {
      // Unreadable file; skip it rather than failing the list.
    }
  }

  return Response.json({ scripts })
}
