#!/usr/bin/env node
/**
 * Turns a word-timed transcript into a Slate script and a cue sheet.
 *
 * The usual case in this repo is the other way round: the board asks for
 * narration and the voice is synthesised. Here the recording already exists and
 * came with per-word timings, which is *better* than anything the TTS route can
 * give us — the beats are not estimated, aligned or matched by phrase, they are
 * read off the file.
 *
 * So the alignment is done once, here, and committed. The player then needs no
 * speech provider, no key and no network: an mp3 and a list of times.
 *
 *   node scripts/align-transcript.mjs <transcript.json> <name>
 *
 * Writes examples/<name>.script.md and examples/<name>.cues.json.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [, , source, name = 'transcript'] = process.argv
if (!source) {
  console.error('usage: node scripts/align-transcript.mjs <transcript.json> <name>')
  process.exit(1)
}

/**
 * Where each scene starts, as a 1-based sentence number.
 *
 * Chosen by reading the transcript, not by counting: a scene is one thing the
 * narrator is explaining, and the only way to find those boundaries is to
 * listen to where they change the subject.
 */
const SCENE_STARTS = [
  1, // what happens behind `docker run`
  8, // a virtual machine boots a whole operating system
  13, // a container is just a process
  18, // the problem: processes can see each other
  24, // the PID namespace
  33, // the other namespaces
  41, // namespaces control sight, not appetite
  47, // a cgroup limit is a number in a file
  53, // the container needs a root directory
  60, // pivot_root, and what has to be in the new root
  66, // an image is a stack of layers
  76, // read-only layers and the thin writable one
  85, // the virtual cable and the bridge
  95, // opening one door to the internet
  98, // the CLI does not start the container
  108, // runc builds it and walks away
  116, // what a container is, in one breath
]

/** Everything after this is "like and subscribe", not the lesson. */
const LAST_SENTENCE = 120

const doc = JSON.parse(readFileSync(source, 'utf8'))

/**
 * Every sentence in the recording, with the moment it starts.
 *
 * Built from the words rather than from each segment's `text`, so the character
 * offsets used to find sentence boundaries index the same string the timings
 * belong to. Splitting the provided text and hoping the two agree is how an
 * alignment ends up one word out for the rest of the file.
 */
const sentences = []
for (const segment of doc.segments) {
  let text = ''
  const startsAt = []
  for (const word of segment.words) {
    for (let i = 0; i < word.text.length; i++) startsAt.push(word.start_time)
    text += word.text
  }

  const boundary = /[^.!?]+[.!?]+["')\]]*\s*/g
  for (const match of text.matchAll(boundary)) {
    const trimmed = match[0].trim()
    if (trimmed) sentences.push({ text: trimmed, start: startsAt[match.index] ?? 0 })
  }
}

const kept = sentences.slice(0, LAST_SENTENCE)
const scenes = SCENE_STARTS.map((from, i) => {
  const to = (SCENE_STARTS[i + 1] ?? LAST_SENTENCE + 1) - 1
  return { n: i + 1, beats: kept.slice(from - 1, to) }
}).filter((scene) => scene.beats.length)

const script = scenes
  .map((scene) => `--- ${scene.n}\n${scene.beats.map((b) => b.text).join(' ')}`)
  .join('\n\n')
writeFileSync(`examples/${name}.script.md`, script + '\n')

// The cue sheet: when each beat is spoken, and when the scene hands over. The
// player seeks the one long recording rather than fetching a clip per scene.
const cues = {
  audio: encodeURI(`/${doc.audio ?? 'Docker Under the Hood (Finally Explained).mp3'}`),
  duration: doc.segments[doc.segments.length - 1].end_time,
  scenes: scenes.map((scene, i) => ({
    n: scene.n,
    start: scene.beats[0].start,
    end: scenes[i + 1]?.beats[0].start ?? kept[kept.length - 1].start + 8,
    beats: scene.beats.map((b) => Math.round(b.start * 100) / 100),
  })),
}
writeFileSync(`examples/${name}.cues.json`, JSON.stringify(cues, null, 1) + '\n')

console.log(`${scenes.length} scenes, ${kept.length} beats, ${cues.duration.toFixed(0)}s`)
for (const scene of cues.scenes) {
  console.log(
    `  scene ${String(scene.n).padStart(2)} · ${String(scene.beats.length).padStart(2)} beats · ` +
      `${scene.start.toFixed(0)}–${scene.end.toFixed(0)}s`
  )
}
