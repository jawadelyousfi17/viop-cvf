#!/usr/bin/env node
/**
 * Records the narration for every saved script, once.
 *
 * Synthesis is the slow, paid part of a lesson, and a script's words never
 * change — so a script is worth recording once and replaying forever. After
 * this, pressing a script on the topic screen has its voice waiting.
 *
 *   node scripts/warm-voice.mjs              # every script, default voice
 *   node scripts/warm-voice.mjs dns          # one script
 *   node scripts/warm-voice.mjs all Hope     # every script, a named voice
 *
 * PORT overrides the dev server port. Safe to re-run: anything already
 * recorded comes back as a cache hit and costs nothing.
 */
const PORT = process.env.PORT ?? 3009
const only = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2] : null
const voiceName = process.argv[3] ?? null

const base = `http://localhost:${PORT}`

const voices = await (await fetch(`${base}/api/voices`).catch(() => null))?.json?.().catch(() => null)
// The picker's ids are stable and small, so fall back to the known default
// rather than requiring an endpoint that exists only for this.
const VOICES = voices?.voices ?? [
  { id: 'BZgkqPqms7Kj9ulSkVzn', name: 'Eve' },
  { id: 'uYXf8XasLslADfZ2MB4u', name: 'Hope' },
  { id: 'MClEFoImJXBTgLwdLI5n', name: 'Ivy' },
]
const voice = voiceName
  ? (VOICES.find((v) => v.name.toLowerCase() === voiceName.toLowerCase())?.id ?? VOICES[0].id)
  : VOICES[0].id

const { scripts } = await (await fetch(`${base}/api/scripts?voice=${voice}`)).json()
const wanted = only ? scripts.filter((s) => s.name === only) : scripts

if (!wanted.length) {
  console.error(only ? `No script called "${only}".` : 'No scripts found.')
  process.exit(1)
}

for (const entry of wanted) {
  const { text } = await (await fetch(`${base}/api/scripts?name=${entry.name}`)).json()
  const { scenes } = await (
    await fetch(`${base}/api/parse-text`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  ).json()

  console.log(`\n${entry.title} — ${scenes.length} scenes`)
  let hits = 0
  let misses = 0
  let seconds = 0

  for (const [i, narration] of scenes.entries()) {
    const started = Date.now()
    const response = await fetch(`${base}/api/tts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: narration, voiceId: voice }),
    })
    if (!response.ok) {
      console.log(`  ${String(i + 1).padStart(2)}  FAILED ${response.status}`)
      continue
    }
    const cached = response.headers.get('x-tts-cache')
    const data = await response.json()
    const clip = data.alignment ? data.alignment.starts.at(-1) : 0
    seconds += clip
    if (cached === 'hit') hits++
    else misses++
    console.log(
      `  ${String(i + 1).padStart(2)}  ${(cached ?? '?').padEnd(4)}  ${String(Date.now() - started).padStart(5)}ms  ${clip.toFixed(1)}s  ${data.alignment ? 'aligned' : 'NO TIMING'}`
    )
  }

  console.log(`  ${hits} already recorded, ${misses} new · ${(seconds / 60).toFixed(1)} min of audio`)
}
