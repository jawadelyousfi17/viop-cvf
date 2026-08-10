#!/usr/bin/env node
/**
 * Records a course's narration once, so playing it never costs anything again.
 *
 *   node scripts/course-voice.mjs javascript-fundamentals
 *
 * A written course is the one lesson in this repo whose words are fixed. That
 * makes its narration content rather than output: synthesise it once, commit
 * the result, and every clone and every replay after that is free. `.gitignore`
 * already keeps `.cache/tts/` for exactly this reason.
 *
 * The script deliberately does no synthesis of its own. It asks the running dev
 * server for the parsed lesson and then asks `/api/tts` for each step, which
 * means provider selection, voice mapping, alignment and the cache key are all
 * the same code the player uses. A second implementation here would be a second
 * cache key, and a second cache key is a bill paid twice for the same audio.
 *
 * So `npm run dev` has to be running. In exchange, a hit here is a hit there.
 *
 *   --voice <id>   one of the ids in lib/voices.ts. Defaults to Eve.
 *   --base <url>   where the server is. Defaults to http://localhost:3000.
 *   --dry          say what would be synthesised, and spend nothing.
 */

/** Flags take a value, `--dry` does not, and anything left over is the slug. */
const positional = []
const options = {}
const args = process.argv.slice(2)

for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === '--dry') options.dry = true
  else if (arg.startsWith('--')) options[arg.slice(2)] = args[++i]
  else positional.push(arg)
}

const slug = positional[0]
const base = (options.base ?? 'http://localhost:3000').replace(/\/$/, '')
const voice = options.voice ?? 'BZgkqPqms7Kj9ulSkVzn'
const dry = !!options.dry

if (!slug) {
  console.error('usage: node scripts/course-voice.mjs <course-slug> [--voice id] [--base url] [--dry]')
  process.exit(1)
}

const bytes = (n) => `${(n / 1024).toFixed(0)} kB`

async function main() {
  let course
  try {
    const response = await fetch(`${base}/api/course?slug=${encodeURIComponent(slug)}&voice=${voice}`)
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    course = await response.json()
  } catch (error) {
    console.error(`Could not reach ${base}. Is \`npm run dev\` running?`)
    console.error(`  ${error.message}`)
    process.exit(1)
  }

  if (course.error) {
    console.error(course.error)
    process.exit(1)
  }

  const errors = (course.problems ?? []).filter((p) => p.severity === 'error')
  if (errors.length) {
    // Recording a lesson that does not compile is the one way to genuinely
    // waste credit: the fix changes the words, and changed words are a new key.
    console.error(`${slug} has ${errors.length} error(s). Fix them before recording:`)
    for (const problem of errors) console.error(`  line ${problem.line}: ${problem.message}`)
    process.exit(1)
  }

  console.log(`${course.title} — ${course.steps.length} steps, voice ${voice}\n`)

  let spent = 0
  let free = 0
  let failed = 0

  for (const [index, step] of course.steps.entries()) {
    const label = `${String(index + 1).padStart(2)}. ${step.title}`
    if (!step.narration.trim()) {
      console.log(`${label} — nothing to say`)
      continue
    }

    const already = course.voiced?.[index]
    if (dry) {
      console.log(`${label} — ${already ? 'already recorded' : 'WOULD SYNTHESISE'}`)
      already ? free++ : spent++
      continue
    }

    try {
      const response = await fetch(`${base}/api/tts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: step.narration, voiceId: voice }),
      })

      if (response.status === 501) {
        console.error(`${label} — no voice provider configured. Set a key in .env.local.`)
        process.exit(1)
      }
      if (!response.ok) {
        console.error(`${label} — failed (${response.status})`)
        failed++
        continue
      }

      const hit = response.headers.get('x-tts-cache') === 'hit'
      const data = await response.json()
      const size = (data.audio?.length ?? 0) * 0.75
      const aligned = data.alignment ? 'word-timed' : 'no timings'

      console.log(`${label} — ${hit ? 'cached' : 'recorded'} · ${bytes(size)} · ${aligned}`)
      hit ? free++ : spent++
    } catch (error) {
      console.error(`${label} — ${error.message}`)
      failed++
    }
  }

  console.log(
    `\n${spent} ${dry ? 'would be synthesised' : 'synthesised'}, ${free} already on disk` +
      (failed ? `, ${failed} failed` : '')
  )
  if (spent && !dry) console.log('Commit .cache/tts/ and nobody pays for these again.')
  if (failed) process.exit(1)
}

void main()
