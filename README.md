# viop

An AI teacher. You give it a topic; it plans a lesson, renders it, and talks you
through it — visuals and narration timed to each other.

**Four rendering engines, chosen on the topic screen** (or via `?engine=`):

| Engine | What it does |
| --- | --- |
| **Whiteboard** (`?engine=whiteboard`) | Draws live on an infinite tldraw canvas with a visible pen, the way a teacher works at a board. Shapes stay grabbable afterwards |
| **Canvas** (`?engine=canvas`) | The same lesson language painted straight onto a 2D canvas. No shape library, so layout is resolved *after* measuring the text — see below |
| **Slides** (`?engine=slides`, default) | Fills twelve designed layouts — journey, timeline, steps, funnel, pillars, mindmap, table, chart, stats, spotlight, gallery, hero |
| **Manim** (`?engine=manim`) | Animated mathematics, rendered by Manim (Python) on the server. For maths and physics, where the motion *is* the explanation |

**The manim engine.** A lesson declares mobjects and the steps that animate them
(`lib/manim-lesson.ts`), and the server compiles that into a Manim script.
Declarative rather than code because a manim scene is normally a Python script —
the model could write that script and we could run it, but executing
model-authored code in the learner's browser is a door worth not opening.
Function expressions for plots go through a small parser (`lib/math-expr.ts`)
for the same reason: `sin(x)` becomes a tree of known operations, never `eval`.

Rendering is **server-side only**. `lib/manim-python.ts` compiles each scene to
a Manim script and `/api/render` renders it to mp4, cached by a hash of the
script. The player asks `/api/render` on startup; without Manim (Python)
installed this engine has no picture, though the narration still plays.

Timing is inverted from manim's own model. Normally `await self.play(...)` runs a
step and moves on; here each step is pinned to the narration phrase it
illustrates, so the waits are *baked into the video* — which is why a scene is
rendered only after its voiceover exists, and why scene N+1 renders while scene
N plays.

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

## Courses — `/course`

The engines above *generate* a lesson. A course is the opposite: it is written,
checked into `courses/*.md`, and identical every time. That one difference is
what the whole route is built on — **the narration text never changes, so its
recording never changes**, so it is synthesised once and read off disk forever
after. A course you replay fifty times while building it costs one synthesis.

`/course` lists what's on the shelf; `/course/javascript-crash-course` is the
complete twenty-minute JavaScript fundamentals course — variables, decisions,
loops, functions, arrays, objects and a first interactive page.

The screen is three panels, each belonging to someone. The teacher talks on the
left and writes in the editor a character at a time; the middle is the editor
and the output of whatever last ran; the board on the right is the learner's
alone. Nothing draws on it but the person watching — when the teacher eventually
draws alongside them, it arrives through the same tldraw editor instance.

**A lesson is markdown.** Prose is narration, one sentence per beat; fenced
blocks are direction, each pinned to a beat number:

````markdown
## const, for a name that never moves

If a name is never going to point at anything else, write const instead of let.
That is not a polite suggestion — reassigning a const is an error.

```js write |2 run
const country = 'Morocco'
console.log(country)
```

```quiz |4
Q What exactly does `const` prevent?
= Pointing that name at a different value
- Changing anything stored inside the value
> It freezes the *binding*, not the value.
```
````

`write` types code in and optionally runs it, `seed` puts code there without
typing, `quiz` asks a question and `task` hands over the keyboard and checks the
output against a pattern. A beat past the end of its step is a build error, not
a shape that quietly lands in the wrong place — the same bargain `docs/slate.md`
makes, for the same reason.

**`point` is the finger.** The narration says "notice there is no `let` on the
second line" and the learner's eye has nowhere to go — twelve lines of code all
look equally relevant, and being told to look at something you cannot find is
worse than not being told at all. So a beat can raise a hand:

```markdown
```point |2 lines=2
no `let` — this is a reassignment
```
```

It bands those editor lines, writes the label in the margin, scrolls them into
view if they are off screen, and holds until the next `point` — because the
sentence explaining a line is still being spoken well after it lands, and a
highlight that has already faded is not pointing at anything. `point |4 out`
marks the output pane instead, for when the interesting thing is what printed.
Every other board language here learned the same lesson; it is `focus` and `hl`
from `docs/slate.md` §9, spelled for an editor.

**Gates block the step, not the sentence.** A quiz or a task appears on its beat
and lets the teacher finish the paragraph, but the lesson will not move to the
next section until a person has dealt with it. A lesson that talks over the
exercise it just set is a video.

**`draw` is the whiteboard.** The right-hand half of the screen is a tldraw
canvas, and the teacher draws a diagram on it for the beats that are *not* about
a particular line of code — a `point` sends the eye to the editor, a `draw` sends
it to the board. It assembles part by part rather than appearing finished:

````markdown
```draw |1
title const freezes the arrow, not the box
box #name list ~good |1
box #arr the array itself ~accent |1
link name arr : frozen |1
cells 'a', 'b', 'c' |5
note The arrow cannot move. What it points at still can. |5
```
````

Eight kinds, and five of them draw a *particular* idea rather than a generic
rectangle — because a board made only of boxes and arrows makes every idea look
like every other idea:

| | |
| --- | --- |
| `title` `note` | a heading, and a line at the foot |
| `box` `link` | a thing, and an arrow between two named things |
| `cells 'H', 'T', 'M'` | indexed cells, with the index under each — how zero-based indexing stops being a sentence and becomes a picture |
| `flow a > b > c` | a sequence, connectors drawn for you |
| `branch <cond> ? <true> : <false>` | a decision, drawn as a fork — read as two stacked boxes, an `if`/`else` looks like a pipeline, which is the one thing it is not |
| `pairs key: value, …` | an object, or any table of two columns |

Tone (`~accent`, `~good`, `~warn`, `~muted`) is meaning;
`components/course/teacher-board.ts` is the only place it becomes a colour.
Every shape is created invisible and faded up, because a shape that simply
exists on the frame its beat arrives reads as a slide changing rather than as
someone explaining.

There are no coordinates, and there will not be any — `lib/course-board.ts`
resolves the whole block's layout up front, so a box arriving at beat five lands
where it was always going to land and nothing already drawn shifts to make room.
A diagram that reflows while someone is reading it is a diagram they have to
re-read. An unknown kind, an unknown tone, or a `link` to a box that does not
exist is a build error, not a shape that quietly fails to appear.

**The board is shared, and the learner's work is never touched.** Every shape the
teacher draws is stamped `meta.teacher`, and clearing between sections removes
only those. You can annotate the diagram — circle the box you did not follow,
write next to it — and moving on wipes the teacher's ink and leaves yours. tldraw
binds each arrow to its two boxes, so dragging a box to look at it from another
angle takes the arrow with it.

**Code runs in a sandboxed iframe** with `allow-scripts` and deliberately
*without* `allow-same-origin` — together those two are the same as no sandbox at
all. The learner's code is never interpolated into the frame's HTML; it arrives
by `postMessage`, so there is no string to escape and no way out by typing
`</script>`. Every run remounts the frame, which is what gives it a clean global
and what stops a runaway loop from the previous attempt.

**Record the narration once:**

```bash
node scripts/course-voice.mjs javascript-variables          # --dry to cost nothing
```

It drives the running dev server rather than synthesising anything itself, so
the provider, the voice mapping and — the point — the *cache key* are all the
same code the player uses. A second implementation here would mean a second key,
and a second key is the same audio bought twice. Commit `.cache/tts/` and nobody
pays again. `/api/course` reports which steps are already recorded, so the
player says so before you press anything.

Without a voice key the lesson still runs: beats fall back to a reading-speed
estimate and it plays silently with the transcript on screen.

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
| `TTS_PROVIDER` | no | `fish` (the default), `elevenlabs` or `openai`. Fish returns word timestamps; ElevenLabs returns character timestamps |
| `FISH_API_KEY` | for fish | Fish Audio key used to create the course narration |
| `FISH_VOICE_ID` | no | Overrides the Fish voice selected in the player |
| `FISH_MODEL` | no | `s2-pro` by default; `s1` is also supported |
| `ELEVENLABS_API_KEY` | for elevenlabs | Without a usable voice key, lessons play silently with captions |
| `ELEVENLABS_VOICE_ID` | no | Defaults to EVE |
| `ELEVENLABS_MODEL_ID` | no | Defaults to `eleven_v3` |
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
exact phrase from the narration it illustrates. Fish Audio's timestamped streaming
endpoint returns word timings (and ElevenLabs returns character timings), so
`components/narrator.ts` can resolve that phrase to a moment in the audio and the
shape is drawn as the voice says it.
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
| `app/api/tts/route.ts` | Voiceover (Fish Audio, OpenAI or ElevenLabs), one request per scene |
| `components/studio.tsx` | Topic screen, playback loop, transport controls |
| `components/paint.ts` | Board language → tldraw shapes, reveal animation, camera |
| `components/narrator.ts` | Audio fetch, cache, prefetch, silent fallback |

## Known limits

- Time to first scene is dominated by the model's own latency before it emits any
  tokens (~7–9s), not by the lesson length. Streaming already hides everything after
  that.
- Fish Audio and ElevenLabs provide timings for word-level sync. On OpenAI voices,
  shapes fall back to the `at` fraction because OpenAI's speech API returns no
  alignment data.
- Layout is whatever the model plans. Shapes are clamped to the scene box and a
  spacing pass opens room for arrow labels, but nothing checks for general overlap
  after the fact.
# viop-cvf
