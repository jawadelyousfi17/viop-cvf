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

Copy it from your own `say` line, two to five words. Matching is
case-insensitive. A shape with no anchor is spread evenly through the scene
instead, which is a worse guess than the one you could have made.

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
| DNS lesson from a topic, 97 shapes | 1,377 | 7,454 | 5.4× |
| The 15-scene DNS script, 238 shapes | 4,356 | 19,247 | 4.4× |

On the script run: 15 of 15 scenes, all 15 narrations byte-identical to the
source, 269 of 270 anchors resolving, no syntax errors, in 30 seconds against
80 for the JSON path — and 18 shapes a scene against 14.3, because the budget
goes on shapes instead of syntax.
