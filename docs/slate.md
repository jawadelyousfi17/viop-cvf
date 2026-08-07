# Slate

A line-based language for drawing explanatory boards, timed to narration.

Slate is Chalk with the guesswork taken out. Every change below exists because
something in Chalk failed silently, had to be policed with prose, or made the
author remember something a compiler could remember for them.

| Chalk problem | Slate fix |
|---|---|
| Anchors matched free text character-for-character, and a miss failed invisibly | Anchors are beat numbers. A bad one is a build error |
| `tbl`, `stk` drew as one atom on one beat | Every row and layer takes its own beat |
| Colour consistency was a rule the author had to remember | Colours are declared roles, used by name |
| Seven container kinds that drew the same thing | Five kinds, each meaning something different |
| Floating `txt` and `num`, policed by a word limit | Text must attach to something. Numbers live in shapes |
| `ring`/`hl` only marked the line above | They take a target name |
| Every scene rebuilt its diagram from scratch | `carry` brings shapes forward |
| `sym` names were guessed into the void | Aliases, then a warning and a generic glyph |
| Shape counts enforced by prose | Enforced by the linter |

**The rule that holds the whole thing up:** you say what things *mean* and
*when*, and the renderer decides where they go. There is no way to write a size,
a position, a width or a coordinate, and there will not be one. Everything added
since the first version — `group`, `compare`, `flow`, `focus`, `transform` — was
added on that condition: it had to be a way of saying something about the
explanation, not a way of drawing.

---

## 0. What it looks like

White paper, black ink, one hand. Every outline on the board is a drawn path —
generated per shape from its real pixel size after layout, wobbling from a seed
so no two edges are wobbly the same way and a replay is identical to the first
run. There are no CSS borders anywhere in the renderer.

Three rules carry the look, and they are worth knowing because they decide how a
source file reads on screen:

**Hierarchy is size, never weight.** One font at one weight; a bold hand-drawn
face reads as a second pen. So write labels in sentence case and let the
renderer size them — a container labels itself large in its top corner, a leaf
box centres its label in the middle. Writing IN CAPS is not emphasis here, it is
just shouting in the same size.

**A container is labelled in the corner; a leaf is labelled in the middle.**
This is automatic and it is why a nested diagram stays legible: the outer box
reads as a boundary with a name on it rather than as another part.

**Space is the layout.** The gaps are large on purpose. A board with room around
its parts reads at a glance; the same board with the gaps filled in has to be
studied. This is also why the shape counts in §13 are a ceiling.

Names (`#cpu`) are shown only while the source pane is open. The board an
audience watches has no ids on it.

---

## 1. A file

```
= Why your CPU has a cache
: Memory is a hundred times slower than the processor, so it keeps a copy nearby.

~ fast    blue
~ slow    yellow
~ problem red

// A remark. Ignored, and the reason a 300-line lesson stays readable.

--- 1 [4 beats] "The gap"
say Your processor does something every third of a nanosecond.
say Main memory takes about a hundred nanoseconds to answer.
say In that time the core could have run three hundred more steps.
say It is not thinking. It is waiting.

sym processor |1
box #cpu PROCESSOR [0.3 ns per step] ~fast |1
box #ram MAIN MEMORY [100 ns per fetch] ~slow |2

-> cpu ram : one value, three hundred steps wasted |3

chart bar "nanoseconds to answer" ~slow |3
  one step  0.3
  L1 cache  1
  memory    100

img computer processor die close up photograph |4
callout this gap is the whole problem ~problem |4
```

`=` title. `:` one-sentence takeaway. `~` declares a colour role. `//` is a
comment, at the start of a line or after one. `---` opens a scene.

---

## 2. The scene header

```
--- 7 [6 beats] "Containers vs virtual machines"
```

Three things, and only the number is required.

**The beat count** is a contract. Written, the compiler can check every anchor
against it whether or not the narration has been attached yet — which is most of
the time a board is being written. If the script *is* attached and disagrees,
that is a build error, because one of the two is out of date and silently
picking either one is how a board drifts off its recording.

**The title** is never rendered. It exists so that errors read

```
scene 7 “Containers vs virtual machines”, beat 7 is past the last beat (6)
```

instead of `build error line 183`. On a seventeen-scene lesson that difference is
most of the debugging.

`[6]`, `[6 beats]` and `beats=6` all work.

---

## 3. Beats

Narration is written as `say` lines. **One sentence per line. Each line is one
beat**, numbered from one within the scene.

```
--- 7 [3 beats]
say Step one: your computer checks its own memory.        beat 1
say Browser cache first, then the operating system's.     beat 2
say If it looked this up recently, we're done.            beat 3
```

A shape is timed by appending `|n`:

| form | means |
|---|---|
| `\|3` | drawn on beat three |
| `\|=` | the same beat as the line above |
| `\|+` | the next beat after the last one anchored |
| `\|++` | two beats on. `\|+++` for three, and so on |
| `\|3..5` | from beat three, held through beat five |
| `\|3+` | drawn on beat three and emphasised for the rest of the scene |
| `\|3*` | deliberately sharing beat three with another shape |
| *(none)* | placed between its anchored neighbours |

Prefer the walking forms:

```
box APP |1
box RUNTIME |+
box LIBRARIES |+
box OS |+
```

They stay correct when a sentence is added to the narration. Hand-numbered beats
do not, and a board whose numbers all shifted by one is a board that still
compiles.

**A beat past the last beat of the scene is a build error.** So is a range that
ends before it starts, and so is two shapes claiming one beat unless you say you
meant it:

```
box #a WEB |4
box #b API |4*     * = yes, both, this beat
```

This is the whole point of the change. Chalk anchors were text hunted for in
prose; when the hunt failed the shape still drew, just on the wrong beat, and
nothing told you. Beat numbers cannot half-work.

### When the script is fixed

If narration is handed to you already written, sentences are numbered for you in
the order they appear, and you write only the shapes:

```
--- 7 [3 beats]
  # 1 Step one: your computer checks its own memory.
  # 2 Browser cache first, then the operating system's.
  # 3 If it looked this up recently, we're done.

stk ~cache |1
  BROWSER CACHE — checked first |1
  OPERATING SYSTEM CACHE |2
  then out to the network |3
```

---

## 4. Kinds

Five containers, each meaning something different. If two kinds would draw the
same thing, there is only one kind.

```
box     a thing that exists
actor   a person, or a system outside the boundary of this explanation
step    one action in a sequence — numbered automatically within its row
choice  a decision or a branch
store   data at rest — a database, a cache, a file
```

Structures:

```
stk     layers, top line uppermost. "on top of", "underneath", "beneath"
arr     indexed cells — arrays, buffers, memory, a tape
tbl     rows and columns of values worth comparing
chart   bar | pie | line
code    source, monospace. ` <` on a line marks the line under discussion
```

Media and lettering:

```
img <query>          a photograph of a real thing. Query ends in "photograph"
sym <name>           a line-art symbol (§11)
sym <name> : words   the symbol, and the line it is there to say
ico <emoji>          one emoji
ico <emoji> : words  the same, in colour
label                a heading with a rule under it
callout              one loose statement per scene, no more (§10)
```

A **captioned** symbol is not decoration, and is not counted as any: it is a
line in a list, drawn glyph-left and words-right at reading size. This is the
shape a property of a thing actually takes on a board, and writing four of them
in a `column` is how a board says "here is what this costs you":

```
column |4
  sym shield : Good isolation ~good |4
  sym warehouse : Heavy — gigabytes on disk |5
  sym stopwatch : About a minute to boot |5
  sym server : A whole OS for every program |6
```

There is no `num`. Numbers belong inside the shape they describe:

```
box RAM [16 GB · 100 ns] ~slow
```

`[...]` is the **stat slot**: set large, inside the shape, under the label. This
is where Chalk's constant reminder — *write the number into the thing, not
beside it* — became syntax.

Shape line, in full:

```
kind #name TEXT [stat] ~role |beat
```

Everything after `kind` is optional. ` / ` inside text is a line break. A kind
nobody recognises is a build error: it used to reach the renderer, which drew it
as a vague box, and the board compiler, which dropped it — two answers to one
typo, neither of them "you have a typo".

---

## 5. Containment, belonging, and arrangement

These are three different things, and Slate spent its first version saying all
of them with indentation.

**Inside.** Indent two spaces and a line goes physically within the line above
it. The container sizes itself and grids its contents.

```
box #os OPERATING SYSTEM ~system |2
  box Scheduler |3
  item Memory manager |4
  item Filesystem |5
  txt never swapped out / shared by every process |6
```

An `item` is a part *named but not boxed* — the light way to list what something
contains, for when four more boxes would just be four more boxes. An indented
`txt` is a full-width line *about* the box. Neither compiles at the top level.

**Belonging.** Sometimes several things go together without one being inside
another. A dashed boundary, with a name on it:

```
group #runtime RUNTIME ENVIRONMENT ~system |2
  box Python 3.12
  box libc
  box ENV
```

**Arrangement.** And sometimes there is no relationship at all beyond where they
sit. This is the weakest thing you can ask for and still be asking for
something, which is exactly why it needs a word — before it had one, authors
invented an arrow that meant nothing.

```
row  column  grid  split  center

row |4
  box DEV
  box TEST
  box PROD
```

`group` takes an arrangement too — `group row #machines`, `group grid` — and any
container can be told one after the fact with `layout column` on a line of its
own inside it.

**Everything inside a `group`, a `row` or a `compare` arrives on the container's
beat** unless given one of its own. They are one arrival; that is what putting
them together meant. Contents of a `box` still take their own beats, because a
thing's parts *are* revealed one at a time.

---

## 6. Blocks take beats per row

`stk`, `arr`, `tbl` and `chart` have a block form. Every row, layer, cell or
bar carries its own beat.

```
stk ~cache |4
  BROWSER — a small cache |5
  OPERATING SYSTEM — one of its own |6
  ROUTER — might keep one |7
  RECURSIVE RESOLVER — very large, millions of users |8
```

```
tbl |1
  : Record | What it does | Example        : marks the header row
  A     | a name to an IPv4 address | 93.184.216.34 |2
  AAAA  | the same, for IPv6        | 2606:2800::1  |3
  CNAME | an alias to another name  | www → example.com |4
```

```
chart bar "hours lost each year" ~problem
  broken builds  120 |2
  env fixes      300 |3
  onboarding      80 |4
```

The single-line form still exists for the cases that genuinely arrive at once:

```
arr 42, 17, 8, 99 |3
tbl Op, Avg / Lookup, O(1) / Insert, O(n) |5
```

An `arr` cell written as `-` is empty on purpose: drawn grey and dashed, and
left unnumbered, because numbering a placeholder claims it is a particular one.
`arr -, -, -, -, -, -, -` is the strip that means "and a great many of these".

In Chalk a six-row table was one shape on one beat: the voice walked six items
while the board sat finished. That was the largest single loss of quality in the
language, and it was a syntax problem, not an authoring one.

---

## 7. Two structures that draw themselves

**A comparison** is two things weighed. The renderer knows what one looks like —
balanced columns, a divider, both halves arriving together — so you do not
arrange one:

```
compare |4
  box #vm VIRTUAL MACHINE [GB · ~60s] ~problem
  box #container CONTAINER [MB · <1s] ~package
```

`compare VM vs CONTAINER |4` works for the case with nothing inside the sides.

**A sequence** draws its own connectors. `-> a b c d` still exists and still
means the same thing; `flow` is for when the sequence *is* the scene and naming
four shapes to join three arrows is all ceremony:

```
flow horizontal #build ~package
  Dockerfile |1
  Image |2
  Registry |3
  Container |4
```

`flow vertical` and `flow cycle` also exist. A step can be a full shape line if
it needs a name or a stat; a bare line is a `step`.

---

## 8. Connectors

```
-> a b : label |beat      flow
--> a b : label |beat     dashed — a fallback, an occasional path
<-> a b : label |beat     both ways
```

Chain sugar, for a sequence:

```
-> browser resolver root tld auth : one question each |3
```

**Layout rules, stated so you can rely on them:**

1. The ends of an arrow are pulled into the same row, in the arrow's direction,
   adjacent, with room for the connector.
2. A chain lays its members left to right in one row, in the order written.
3. A shape that appears in two chains is placed by the first one; the second
   routes to it.
4. Chains longer than five wrap to a second row and the connector wraps with
   them.

### Relationships that are not flow

`->` says "and then". Most of what a system diagram needs to say is not that. A
container and its host *share* a kernel; a volume *mounts* into a path; a port
*maps* to a port. Drawn as arrows, every one of those made the diagram look like
a pipeline.

```
depends   contains   shares   maps   mounts   uses

shares #container #kernel : one kernel, many containers |3
mounts volume container |5
```

The `#` is optional on these. They draw as a brace with no arrowhead, because
none of them has a direction of travel and an arrowhead asserts one.

### Forks

A branch is written inside the decision it leaves, because a fork read as three
separate lines is not read as a fork:

```
branch #cache CACHE HIT? |2
  YES -> response
  NO -> database
```

`choice` takes the same block form.

---

## 9. Attention, and change

A board is not only a set of things that appear. Most of what a person at a
whiteboard actually does is point at what is already there, and cross things
out.

```
show #x |3          bring it in now — overrides where it would have arrived
hide #x |6          take it away
dim #x |4           push it back — for the thing being superseded
focus #x |4         this is what matters now; everything else goes back
ring #x |6          circle it
hl #x |6            highlight it
note #x remark |7   a line under it
```

`focus` is the hand on the board: it lifts the thing named and pushes everything
else back until the next `focus`, or until its range runs out.

```
focus #container |2..4
focus #vm |5
```

All of these take a range. Targets can be a row inside a block:

```
hl #records.3 |5     the third row of the table named #records
hl #stack.top |4     the top layer
```

### When a thing becomes another thing

Source code → image → container is one board evolving, not three boards of the
same subject.

```
box #source SOURCE CODE ~package |1

transform #source |3
  DOCKER IMAGE [read-only]

transform #source |5
  RUNNING CONTAINER [1 process]
```

`transform` changes what a shape *says* and keeps the shape. Every reading is
stacked in the same cell, so the board never reflows around a word changing, and
it only works on shapes that have a single label — a table has no one reading to
swap, and a `transform` on one is a build error rather than a line that does
nothing.

`replace` puts a *different shape* in the same place:

```
replace #plaintext #ciphertext |5

replace #code
  box #image DOCKER IMAGE ~package |3
```

The block form defines the replacement on the spot; the beat can go on either
line, because the exchange and the arrival are one moment.

---

## 10. Text has to attach

`callout` is the only free-floating lettering, **one per scene**, for the one
thing the scene is really claiming.

Everything else attaches: `item` and `txt` inside a shape, `note` from anywhere
on the board. A `txt` or `item` at the top level is a build error. Chalk's "at
most three loose lines a scene" was prose compensating for a syntax that made a
noticeboard the easiest thing to build.

---

## 11. Symbols

`sym` draws from a published set:

```
antenna  battery  browser window  cable  cache  calendar  card index  clock
cloud  compass  container  database  disk  dna  document  envelope  file
folder  gear  globe  heart  hourglass  key  layers  leaf  map  memory chip
network  neuron  open padlock  padlock  people  person  phone  pipe
processor  queue  receipt  router  scales  server  shield  signpost
stopwatch  switch  terminal  tree  turbine  valve  warehouse  wrench
happy face  neutral face  sad face
```

The three faces are verdicts. A board argues, and the cheapest honest way to say
"and this is the bad one" is a face — no colour, no exclamation mark, and no
adjective the narration then has to repeat. `sad`, `bad`, `good` and `ok` all
resolve to one.

The words people actually reach for resolve to those: `cpu`, `core`, `kernel`,
`chip`, `ram`, `db`, `storage`, `bucket`, `net`, `internet`, `window`, `browser`,
`shell`, `vm`, `host`, `image`, `stack`, `docker`, `package`, `pod`, `lock`,
`secret`, `mail`, `doc`, `user`, `users`, `time`, `timer`, `cog`, `settings`,
`build`, `tradeoff`, `brain`, `route`, and a few more. Add your own:

```
symbol whale = container
```

An unknown name **draws the generic glyph and warns**. It used to fail the
build, which meant writing a Docker board and instinctively typing `sym whale`
stopped everything over a decoration. A missing icon is a blemish, and a blemish
should never cost a lesson.

Two to four to a scene; a second symbol of something already drawn is one of the
lint warnings below.

---

## 12. Colour is a role, not a colour

```
~ name     blue
~ address  green
~ resolver violet
~ cache    orange
~ problem  red
~ inert    grey
```

Then `~name` on any shape, for the whole lesson. Consistency stops being
something you remember and becomes something you declared once. A literal
`@blue` still works and still draws, but the linter flags it, because a literal
colour is a decision no one can find later.

Recolouring a lesson is six lines.

---

## 13. What the linter checks

The rules Chalk stated in prose and hoped for. Problems are reported in document
order, and the ones that matter carry the scene's title.

**Errors — things that will be wrong and cannot be seen from the source:**

- a beat past the last beat of its scene, or a range that ends before it starts
- a declared beat count that disagrees with the attached narration
- an unrecognised kind
- two argument-carrying shapes on one beat without `*`. Media is exempt — a
  `sym` beside the box it illustrates is the same thing drawn, not a second
  thing to read — and so are the contents of a `group` or a `compare`, which
  arrive together by definition
- a `~role` that was never declared, or a `symbol x = y` whose `y` is not a glyph
- a top-level `txt` or `item`, or a second `callout`
- a name pointed at by `->`, a relation, a branch arm, `hl`, `ring`, `dim`,
  `focus`, `show`, `hide`, `note`, `transform` or `replace` that does not exist
- a `transform` on a shape with no single label to change
- a `carry` of a name no earlier scene defines

**Warnings — judgements about quality, which do not get to stop a build:**

- an unknown `sym` name
- more than thirteen shapes in a scene, or fewer than four. Arrangement is not
  counted: a group of three boxes is three shapes, not four
- more than one `img` in a scene, or no `img` anywhere in the lesson — a
  diagram-only scene is a fine thing, a lesson with no photograph of anything
  real in it is a lecture about words
- a scene with nothing pictorial at all: no `img`, no `sym`, no `ico`
- more than four *bare* `sym`. A captioned one is content and is not counted
- **five or more things arriving on one beat** — consider splitting the reveal
- **three or more consecutive beats with nothing arriving**, named as a range:
  *no visual change during beats 3–5*. The board has stalled and the voice is
  talking to a still picture
- half or more of the beats empty
- a `compare` without two sides, a `flow` under two steps, a `group` of one, a
  fork with one arm
- a shape whose text repeats its container's label
- a literal colour where a role would do; a declared name never referenced

The counts are a ceiling, not a target. A scene that says what it needs in seven
shapes is finished at seven.

---

## 14. Scenes that continue

```
--- 5 [4 beats] "The registered name"
carry #tld #sld
box #reg THE REGISTERED NAME [example] ~name |4
```

`carry` brings named shapes forward from the previous scene. They appear at beat
zero, already drawn, dimmed, in their previous arrangement; new shapes lay out
around them. `carry all` takes everything. `recall #name` reaches further back,
to any scene in the lesson.

A carried shape arrives with none of the previous scene's attention on it — a
ring drawn in scene seven is about scene seven.

This is what makes a sequence feel like one lecture instead of fifteen posters.
The DNS hierarchy — root, TLD, second level, registered name, subdomain — is one
diagram assembled across three scenes, not three diagrams of the same thing.

---

## 15. How to draw a scene

In this order, every time:

1. **Say what the scene claims**, to yourself, in one sentence. That sentence is
   the scene, and it is what goes in the header's quotes. Anything belonging to
   the next point belongs to the next scene.
2. **Pull out the concrete things** — names, numbers, parts, steps, the
   comparison. Those become shapes. The rest is talk, and the voice carries it.
3. **Pick the one structure that fits.** Layers → `stk`. A sequence → `flow`.
   Two cases weighed → `compare`. Parts of a whole → indentation. Things that go
   together → `group`. Values worth comparing → `tbl` or `chart`. Most scenes
   have one structure and a little detail around it.
4. **Walk the beats from one to the last** and hand each shape the beat where it
   is actually mentioned — with `|+`, not by counting. If two shapes have no
   separate beat between them, one of them is a shape you do not need.
5. **Ask what is already on the board.** If the narration returns to something,
   `focus` it or `transform` it. Drawing it again is the commonest way a board
   gets crowded.
6. **Read it back and cut.** For each line, ask what it says that nothing else
   already says. If the answer is nothing, delete it.

Delete on sight: a `txt` restating its shape's label; a second symbol of
something already drawn; a stat repeated beside the shape that contains it; an
arrow between two shapes whose relationship is obvious from where they sit; a
`note` summarising what the narration is about to say anyway; any line written
because a rule permitted it rather than because the scene needed it.

Space is not waste. A board with room around its parts reads at a glance. The
same board with the gaps filled in has to be studied.

---

## 16. Worked scene

Narration, fixed:

> Here are the two ways people ship software. A container is small and starts
> almost instantly. It shares the kernel of the machine it runs on. A virtual
> machine carries a whole operating system of its own. So where does a container
> come from? From an image — and the kernel is the whole trick.

```
--- 7 [6 beats] "Containers vs virtual machines"
compare |1
  box #container CONTAINER [MB · under a second] ~package
  box #vm VIRTUAL MACHINE [GB · about a minute] ~problem

focus #container |2
box #kernel SHARED HOST KERNEL ~system |3
shares #container #kernel : one kernel, many containers |3*

focus #vm |4
note #vm carries a whole operating system of its own |4

box #image IMAGE ~package |5
-> image container : one image, many containers |5*

sym container |2
sym server |4
img shipping containers stacked on a dock photograph |5
callout the kernel is the whole trick ~package |6
```

Six beats, nine shapes, nothing drawn twice, every beat with something
happening — and two of the six beats draw nothing new at all. They move the
attention instead, which is the thing the language could not say before.

The author did not write a pixel, a width, an arrow route or a keyframe. They
wrote the explanation.

---

## Card

```
= title                          : takeaway              ~ role colour
--- n [b beats] "title"          say <sentence>          one line, one beat
// remark                        symbol alias = glyph

kind #name TEXT [stat] ~role |beat
  indented line                  goes inside the line above

box actor step choice store      containers
group                            belonging — a dashed boundary
row column grid split center     arrangement, nothing more
compare                          two things weighed, balanced for you
flow [horizontal|vertical|cycle] a sequence, connectors drawn for you
branch #x TEXT                   a fork; arms written inside it
stk arr tbl chart code           structures — block form, one beat per row
img sym ico label callout        media and lettering
txt item note                    attached text only

-> a b : label |beat             flow, chain, layout
--> <->                          dashed, both ways
depends contains shares          relationships that are not flow
maps mounts uses

show hide dim focus hl ring      attention, all range-capable
note #target text |beat          a remark on a shape
transform #x |beat               the same shape, saying something new
replace #old #new |beat          a different shape, in the same place
carry #a #b   recall #a          bring shapes forward

|3  |=  |+  |++  |3..5  |3+  |3*  a beat, again, next, later, held, kept, shared
blank line                       ends a row
```

Never write a size, a position or a coordinate. They are worked out for you.
