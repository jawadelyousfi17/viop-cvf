#!/usr/bin/env node
/**
 * Generates a board from a script and reports whether it is any good.
 *
 * Narration is fixed by the script, and the audio for it is already on disk,
 * so nothing here spends a TTS request. What varies run to run is only the
 * drawing — which is the thing worth measuring.
 *
 *   node scripts/board-test.mjs                     # the DNS script, OpenAI
 *   node scripts/board-test.mjs scripts/prozac.md
 *   node scripts/board-test.mjs scripts/dns.md claude
 *
 * PORT overrides the dev server port.
 */
import { readFile } from 'node:fs/promises'

const PORT = process.env.PORT ?? 3009
const file = process.argv[2] ?? 'scripts/dns.md'
const provider = process.argv[3] ?? 'openai'

const FLOATING = new Set(['arrow', 'elbow', 'curve', 'line', 'highlight', 'laser', 'ring'])
const isFrame = (s) =>
  s.kind === 'box' && !s.text.trim() && (s.dash === 'dashed' || s.dash === 'dotted')

const script = await readFile(file, 'utf8')

// What the script should come back as, so a dropped scene is visible.
const wanted = await (
  await fetch(`http://localhost:${PORT}/api/parse-text`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: script }),
  })
).json()

const started = Date.now()
const response = await fetch(`http://localhost:${PORT}/api/lesson`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ topic: '', script, engine: 'whiteboard', provider }),
})
if (!response.ok) {
  console.error('HTTP', response.status, (await response.text()).slice(0, 300))
  process.exit(1)
}

const scenes = []
let meta = {}
let buffer = ''
for await (const chunk of response.body) {
  buffer += Buffer.from(chunk).toString('utf8')
  const lines = buffer.split('\n')
  buffer = lines.pop() ?? ''
  for (const line of lines) {
    if (!line.trim()) continue
    const event = JSON.parse(line)
    if (event.type === 'scene') scenes.push(event.scene)
    if (event.type === 'meta') meta = event
    if (event.type === 'error') console.error('  ERROR', event.message)
  }
}

const BOARD_W = 1920
let totals = { shapes: 0, symbols: 0, images: 0, overlaps: 0, anchors: 0, matched: 0, exact: 0 }
const rows = []

for (const [i, scene] of scenes.entries()) {
  const solid = scene.shapes.filter((s) => !FLOATING.has(s.kind))

  let overlaps = 0
  for (let a = 0; a < solid.length; a++) {
    for (let b = a + 1; b < solid.length; b++) {
      const p = solid[a]
      const q = solid[b]
      if (p.group && p.group === q.group) continue
      if (isFrame(p) || isFrame(q)) continue
      if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) overlaps++
    }
  }

  const minX = Math.min(...solid.map((s) => s.x))
  const maxX = Math.max(...solid.map((s) => s.x + s.w))
  const minY = Math.min(...solid.map((s) => s.y))
  const maxY = Math.max(...solid.map((s) => s.y + s.h))

  // Case-insensitive, like the player's own anchor resolver.
  const haystack = scene.narration.toLowerCase()
  const anchored = scene.shapes.filter((s) => s.anchor)
  const matched = anchored.filter((s) => haystack.includes(s.anchor.trim().toLowerCase())).length
  const exact = wanted.scenes[i] !== undefined && scene.narration.trim() === wanted.scenes[i].trim()

  const symbols = scene.shapes.filter((s) => s.kind === 'symbol').length
  const images = scene.shapes.filter((s) => s.kind === 'image').length

  totals.shapes += scene.shapes.length
  totals.symbols += symbols
  totals.images += images
  totals.overlaps += overlaps
  totals.anchors += anchored.length
  totals.matched += matched
  if (exact) totals.exact++

  rows.push([
    i + 1,
    scene.shapes.length,
    symbols,
    images,
    `${Math.round(((maxX - minX) / BOARD_W) * 100)}%`,
    ((maxX - minX) / (maxY - minY)).toFixed(2),
    `${matched}/${anchored.length}`,
    overlaps,
    exact ? '·' : 'CHANGED',
  ])
}

const pad = (v, n) => String(v).padStart(n)
console.log(`\n${meta.title ?? '(no title)'} — ${provider}, ${((Date.now() - started) / 1000).toFixed(1)}s`)
console.log(`${scenes.length} of ${wanted.scenes.length} scenes\n`)
console.log(' sc  shapes  sym  img  width  aspect   anchors  ovl  narration')
for (const r of rows) {
  console.log(
    `${pad(r[0], 3)}  ${pad(r[1], 6)}  ${pad(r[2], 3)}  ${pad(r[3], 3)}  ${pad(r[4], 5)}  ${pad(r[5], 6)}  ${pad(r[6], 8)}  ${pad(r[7], 3)}  ${r[8]}`
  )
}

const n = scenes.length || 1
console.log(
  `\nshapes/scene ${(totals.shapes / n).toFixed(1)} · symbols ${totals.symbols} · images ${totals.images}` +
    `\nanchors ${totals.matched}/${totals.anchors} verbatim · overlaps ${totals.overlaps}` +
    `\nnarration unchanged ${totals.exact}/${scenes.length}`
)

if (totals.matched < totals.anchors || totals.exact < scenes.length || scenes.length !== wanted.scenes.length) {
  process.exitCode = 1
}
