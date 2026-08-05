# viop

An AI teacher. You give it a topic; it plans a lesson, renders it, and talks you
through it — visuals and narration timed to each other.

**Four rendering engines, chosen on the topic screen** (or via `?engine=`):

| Engine | What it does |
| --- | --- |
| **Whiteboard** (`?engine=whiteboard`) | Draws live on an infinite tldraw canvas with a visible pen, the way a teacher works at a board. Shapes stay grabbable afterwards |
| **Canvas** (`?engine=canvas`) | The same lesson language painted straight onto a 2D canvas. No shape library, so layout is resolved *after* measuring the text — see below |
| **Slides** (`?engine=slides`, default) | Fills twelve designed layouts — journey, timeline, steps, funnel, pillars, mindmap, table, chart, stats, spotlight, gallery, hero |
| **Manim** (`?engine=manim`) | Animated mathematics, on the `manim-ts` library. For maths and physics, where the motion *is* the explanation |

**The manim engine.** A lesson declares mobjects and the steps that animate them
(`lib/manim-lesson.ts`), and the player translates that into manim-ts calls.
Declarative rather than code because a manim scene is normally a Python script —
the model could write that script and we could run it, but executing
model-authored code in the learner's browser is a door worth not opening.
Function expressions for plots go through a small parser (`lib/math-expr.ts`)
for the same reason: `sin(x)` becomes a tree of known operations, never `eval`.

Timing is inverted from manim's own model. Normally `await self.play(...)` runs a
step and moves on; here each step blocks until the narration reaches the phrase
it illustrates, so the animation is led by the voice.

**Why the canvas engine exists.** With tldraw the box is declared before the
text is measured, so a label that wraps to three lines silently grows past the
space reserved for it and lands on its neighbour — an audit of two generated
lessons found 32 such collisions. The canvas renderer measures every label
first (`lib/canvas-layout.ts`), grows each shape to fit, then pushes any
remaining overlaps apart before a single stroke is drawn. The trade is that
nothing on the board is editable afterwards.

They share everything else: streaming generation, word-level narration sync,
voices, mid-lesson questions, follow-ups and session memory (photographs on all
but manim, which draws rather than illustrates). The
API routes take an `engine` field and dispatch to that engine's prompt and
schema; `lib/engines.ts` is the only place they are enumerated.

Try it without any API keys: <http://localhost:3000/?demo=1> plays a hand-written
lesson so you can see the whole player working.

## Setup

```bash
npm install
cp .env.example .env.local   # add your keys
npm run dev
```

| Variable | Required | Notes |
| --- | --- | --- |
| `OPENAI_API_KEY` | yes | Writes the lesson |
| `OPENAI_MODEL` | no | Defaults to `gpt-5.6-luna`. Must support structured outputs |
| `TTS_PROVIDER` | no | `elevenlabs` or `openai`. Only ElevenLabs returns the timestamps that sync each shape to its word |
| `ELEVENLABS_API_KEY` | for elevenlabs | Without a usable voice key, lessons play silently with captions |
| `ELEVENLABS_VOICE_ID` | no | Defaults to EVE |
| `ELEVENLABS_MODEL_ID` | no | Defaults to `eleven_multilingual_v2` |
| `OPENAI_TTS_MODEL` | no | Defaults to `gpt-4o-mini-tts`. `tts-1` is faster and cheaper but not steerable |
| `OPENAI_TTS_VOICE` | no | Defaults to `sage` |
| `UNSPLASH_ACCESS_KEY` | no | Tried first. 50 requests/hour on a demo app |
| `GOOGLE_CSE_KEY` + `GOOGLE_CSE_ID` | no | Google Programmable Search, 100 free queries/day |
| `SERPAPI_KEY` | no | Tried third |
| `NEXT_PUBLIC_TLDRAW_LICENSE_KEY` | for production | tldraw runs unlicensed on localhost only |

**Images need no key.** The search tries Unsplash, then Google, then SerpApi,
then Openverse and Wikimedia Commons — and that last pair needs no key, no
project and no card, so it always answers. Unsplash leads because its results
are what a board actually wants: large, deliberate photographs of real objects.
Commons is the better source for science and machinery. When a tier runs dry the
chain falls through automatically and remembers, so the dead provider isn't
asked again that session.

A lesson spends roughly a dozen searches, so an Unsplash demo app covers about
four lessons an hour before quietly handing over to the keyless pair.

**When pictures stop appearing**, open `/api/image/test?q=apple&html=1`. The board
draws the same dashed placeholder whether the key is wrong, the quota is spent,
or the host refused the fetch — the test route names which one it was, shows
which provider actually served, and renders every candidate with the verdict on
each.

## How it works

**One call, streamed.** `POST /api/lesson` asks OpenAI for the whole lesson in a
single structured-output call (`lib/prompt.ts`, schema in `lib/lesson.ts`) and streams
the response. Because the model writes scenes in order, `lib/lesson-stream.ts` pulls
each scene object out of the half-written JSON the moment its braces balance and
pushes it to the player as a newline-delimited event.

The practical effect: **the board goes live in ~8–12s instead of ~34s**, and the rest
of the lesson is written while scene one plays. Generation runs about 4s per scene
against roughly 18s of playback, so it stays comfortably ahead. If it ever falls
behind, playback holds on the current scene ("Writing the next scene…") and resumes
the instant the next one lands.

**Scene-local coordinates.** Every scene is planned inside the same fixed 1200×800
box, so the model never has to reason about where previous scenes ended up. The
player offsets each scene horizontally onto one shared canvas and pans between them
— which is why the finished lesson reads as one long whiteboard rather than a deck.

**Drawing follows the voice, word by word.** Each shape carries an `anchor` — the
exact phrase from the narration it illustrates. ElevenLabs' `/with-timestamps`
endpoint returns a start time per character, so `components/narrator.ts` can resolve
that phrase to a moment in the audio and the shape is drawn as the voice says it.
Shapes also carry an `at` fraction, used as the fallback when the phrase can't be
matched, when the provider returns no alignment (OpenAI returns none), or when
there's no voice key at all. One `requestAnimationFrame` loop reads
`audio.currentTime` and paints on schedule, so pause, resume and scene-skip all work
without separate timer bookkeeping.

**Real tldraw shapes.** `components/paint.ts` translates the model's board language
into tldraw shapes: geo, text and note; arrows *bound* to the shapes they connect;
`curve` and `highlight` as freehand strokes; `line` and `axes` for plots and
brackets. So a lesson can draw an actual graph — and once it has played you can grab
anything on the board and move it.

| File | Role |
| --- | --- |
| `lib/lesson.ts` | Board language: types, JSON schema, layout constants, repair pass |
| `lib/lesson-stream.ts` | Pulls whole scenes out of partial JSON as it streams |
| `lib/prompt.ts` | What the teacher is told about drawing and narrating |
| `app/api/lesson/route.ts` | Lesson generation, streamed as NDJSON events |
| `app/api/tts/route.ts` | Voiceover (OpenAI or ElevenLabs), one request per scene |
| `components/studio.tsx` | Topic screen, playback loop, transport controls |
| `components/paint.ts` | Board language → tldraw shapes, reveal animation, camera |
| `components/narrator.ts` | Audio fetch, cache, prefetch, silent fallback |

## Known limits

- Time to first scene is dominated by the model's own latency before it emits any
  tokens (~7–9s), not by the lesson length. Streaming already hides everything after
  that.
- Word-level sync needs ElevenLabs. On OpenAI voices, shapes fall back to the `at`
  fraction, because OpenAI's speech API returns no alignment data.
- Layout is whatever the model plans. Shapes are clamped to the scene box and a
  spacing pass opens room for arrow labels, but nothing checks for general overlap
  after the fact.
