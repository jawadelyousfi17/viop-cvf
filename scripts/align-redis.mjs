#!/usr/bin/env node
/**
 * The Redis lesson's cue sheet, from YouTube-style timestamped captions.
 *
 * Coarser material than the Docker transcript: a stamp every couple of
 * seconds, per caption fragment rather than per word. Word times are
 * interpolated evenly inside each fragment, which lands a sentence within a
 * few hundred milliseconds of where it is actually spoken — plenty, since a
 * beat only decides when a drawing starts to arrive.
 *
 *   node scripts/align-redis.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

/** Sentence numbers where the narrator changes subject. Chosen by reading. */
const SCENE_STARTS = [1, 4, 10, 16, 20, 23, 26, 29, 39, 44, 48, 54, 62, 67, 71, 76, 81, 87, 92]
/** Everything after this is "like and subscribe", not the lesson. */
const LAST_SENTENCE = 94
const AUDIO = 'Redis will finally make sense after this video.mp3'
const DURATION = 483.1

const raw = readFileSync('examples/redis.captions.txt', 'utf8')

const fragments = [...raw.matchAll(/\[(\d\d):(\d\d):(\d\d)\]([^[]+)/g)].map((m) => ({
  t: +m[1] * 3600 + +m[2] * 60 + +m[3],
  words: m[4].trim().split(/\s+/).filter(Boolean),
}))

const words = []
fragments.forEach((f, i) => {
  const end = fragments[i + 1]?.t ?? f.t + 2
  f.words.forEach((w, j) => words.push({ w, t: f.t + ((end - f.t) * j) / f.words.length }))
})

// Character offset → time, so sentence boundaries index the same string the
// timings belong to.
const text = words.map((x) => x.w).join(' ')
const starts = []
let pos = 0
for (const x of words) {
  starts.push({ at: pos, t: x.t })
  pos += x.w.length + 1
}
const timeAt = (idx) => {
  let best = 0
  for (const s of starts) {
    if (s.at <= idx) best = s.t
    else break
  }
  return best
}

const sentences = []
const boundary = /[^.!?]+[.!?]+["')\]]*\s*/g
let match
while ((match = boundary.exec(text))) {
  sentences.push({ text: match[0].trim(), t: timeAt(match.index) })
}

const kept = sentences.slice(0, LAST_SENTENCE)
const scenes = SCENE_STARTS.map((from, i) => {
  const to = (SCENE_STARTS[i + 1] ?? LAST_SENTENCE + 1) - 1
  return { n: i + 1, beats: kept.slice(from - 1, to) }
})

const cues = {
  audio: encodeURI(`/${AUDIO}`),
  duration: DURATION,
  scenes: scenes.map((scene, i) => ({
    n: scene.n,
    start: scene.beats[0].t,
    end: scenes[i + 1]?.beats[0].t ?? kept[kept.length - 1].t + 9,
    beats: scene.beats.map((b) => Math.round(b.t * 100) / 100),
  })),
}
writeFileSync('examples/redis.cues.json', JSON.stringify(cues, null, 1) + '\n')

const script = scenes
  .map((scene) => `--- ${scene.n}\n${scene.beats.map((b) => b.text).join(' ')}`)
  .join('\n\n')
writeFileSync('examples/redis.script.md', script + '\n')

console.log(`${scenes.length} scenes, ${kept.length} beats`)
for (const s of cues.scenes) {
  console.log(
    `  scene ${String(s.n).padStart(2)} · ${String(s.beats.length).padStart(2)} beats · ${s.start.toFixed(0)}–${s.end.toFixed(0)}s`
  )
}
