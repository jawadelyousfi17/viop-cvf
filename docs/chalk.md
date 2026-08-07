# Chalk

A small line-based language for boards. One shape a line, no coordinates, and
the two things that matter — colour and timing — given a single character each.

Compiled by `lib/chalk.ts`. Try it: `POST /api/chalk` with `{"topic": "..."}`
or `{"script": "..."}`.

## The shape of a document

```
= lesson title
: one sentence on what the learner comes away with

---
say the narration for this scene
say another line, joined to the one above with a space

box FIRST THING @blue | narration for this
box SECOND THING @yellow | another line

img a photograph of the thing | joined to the one
```

Four line types, decided by the first token:

| line | means |
| --- | --- |
| `= text` | the lesson's title |
| `: text` | the lesson's summary |
| `---` | start a new scene |
| `say text` | narration. Repeat the line; the parts are joined with a space. |
| `say ^` | use the narration this scene was given, without retyping it |
| `flow` | a Mermaid flowchart follows, indented, ending at a blank line |
| `-> a b : label \| anchor` | an arrow from `#a` to `#b` |
| *(blank line)* | end the current row |
| anything else | a shape — see below |

## A shape line

```
kind [#name] text [@colour] [= data] [| anchor]
```

Only `kind` and `text` are required.

```
box PROCESSOR @blue | your processor does
box #cpu PROCESSOR / 0.3 ns per step @blue | your processor does
bar time to answer @blue = step 0.3, L1 1, memory 100 | in that time
```

- **`#name`** — names the shape so an arrow can point at it. Only needed for
  arrow endpoints.
- **`@colour`** — `blue green red violet yellow orange grey black`. On a
  container this also tints it.
- **`| anchor`** — the phrase in this scene's narration the shape lands on.
  Must be the **last** `|` on the line.
- **`= data`** — chart numbers, `label value, label value`. Read only by
  `bar`, `plot` and `pie`.
- **` / `** — a line break inside the text, and a new row inside `tbl`/`stk`.

## Kinds

| | |
| --- | --- |
| `box` `oval` `ell` `dia` `hex` `star` `cloud` | containers; `box` is the normal one |
| `lab` | a heading — lettering with a rule under it |
| `txt` | plain lettering: a note, a formula, a remark |
| `num` | a number or unit, set large |
| `note` | a sticky note, for an aside |
| `img <query>` | a photograph, fetched by search |
| `sym <thing>` | a line-art symbol, fetched by name — `router`, `kidney` |
| `ico <emoji>` | one emoji |
| `tbl` | a table. Commas are columns, ` / ` is a new row, first row is the header |
| `arr` | cells with indices drawn under them — arrays, memory, a buffer |
| `stk` | stacked layers, ` / ` between them |
| `bar` `plot` `pie` | charts; numbers go in `= …` |
| `ring` | circles whatever was written on the line above |
| `hl` | highlights whatever was written on the line above |

## Things inside other things

Indent a line and it goes inside the line above it. The container grows to fit
what it holds and arranges it in a grid — no size or position is written for
either.

```
box #os OPERATING SYSTEM @blue | the operating system
  box Scheduler @green
  box Memory manager @green
  box Filesystem @green

box HARDWARE @grey | underneath it all
```

Two spaces to a level, and it nests as deep as it needs to. A container's text
is its heading, so name it.

## Rows

A blank line ends a row. Shapes written together sit side by side; the next
group starts a band lower down the board.

```
box ONE @blue | first
box TWO @blue | second        <- these three share a row
box THREE @blue | third

img the thing photograph | and then           <- new row
```

Positions are worked out by the layout pass. There are no coordinates in the
language, and no way to write one.

## Anchors

`| words` names the phrase in **this scene's** narration that the shape
illustrates. When the voice reaches those words, the shape is drawn.

Copy it from the narration, two to five words. Matching is case-insensitive.

**Anchors are optional.** A shape without one is placed *between its anchored
neighbours*, so a line written between two anchored lines already lands in the
right place. Anchor the first shape of a row and the one carrying its point;
leave the rest bare.

## Narration you already have

When a script is being drawn, the narration is attached to each scene before
the model sees it, and there is no reason to write it out again — so scenes
carry no `say` lines at all. It was thirty per cent of everything Chalk
produced, and the only route by which a script could come back altered.

## Separators never eat your text

Each separator is narrow about when it counts, because the alternative is a
language that quietly swallows content:

- `=` is data **only on a chart**, so `txt z = Wx + b` keeps its formula.
- `@` is a colour **only when it names one**, so `txt reach me @home` survives.
- `|` is the **last** one on the line, so `arr 42, 17, 8, 99 | four values`
  splits where you meant.
- Cells are commas, never pipes, so a table's own columns can't be mistaken for
  an anchor.

## Errors

Compilation is forgiving. An unknown kind or an arrow missing an endpoint is
reported with its line number and skipped — one bad line costs one shape, not
the lesson.

## Worked example

```
= Why your CPU has a cache
: Memory is a hundred times slower than the processor, so it keeps a copy nearby.

---
say Your processor does something every third of a nanosecond. Main memory takes
say about a hundred nanoseconds to answer. In that time the core could have run
say three hundred more steps. It is not thinking. It is waiting.

box #cpu PROCESSOR / 0.3 ns per step @blue | processor does something
box #ram MAIN MEMORY / 100 ns per fetch @yellow | hundred nanoseconds
-> cpu ram : one value / three hundred steps wasted | three hundred more steps

sym processor | every third of a nanosecond
sym memory chip | Main memory takes
img computer processor die close up photograph | It is waiting

bar nanoseconds to answer @blue = one step 0.3, L1 1, memory 100 | In that time
num 300x @red | three hundred more steps
txt this gap is the whole problem @red | It is waiting
hl | It is waiting
```

## What it costs

Token counts from the tokeniser of the model that writes it, not estimated
from character counts.

| | Chalk | the same lesson as JSON | |
| --- | --- | --- | --- |
| The 15-scene DNS script, 198 shapes | 2,244 | 17,961 | **8.0×** |

On that run: 15 of 15 scenes, every narration byte-identical to the source
because it was never retyped, 206 of 208 anchors resolving, no compile errors.
**The first scene arrives after 3.5 seconds**; the whole lesson takes 24,
against 80 for the JSON path.

It started at 4.4×. Dropping the copied narration and letting anchors be
optional took it to 8×.
