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
| `sym` names were guessed into the void | Closed vocabulary, unresolved name is an error |
| Shape counts enforced by prose | Enforced by the linter |

---

## 1. A file

```
= Why your CPU has a cache
: Memory is a hundred times slower than the processor, so it keeps a copy nearby.

~ fast    blue
~ slow    yellow
~ problem red

--- 1
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

`=` title. `:` one-sentence takeaway. `~` declares a colour role. `---` opens a
scene, numbered.

---

## 2. Beats

Narration is written as `say` lines. **One sentence per line. Each line is one
beat**, numbered from one within the scene.

```
--- 7
say Step one: your computer checks its own memory.        beat 1
say Browser cache first, then the operating system's.     beat 2
say If it looked this up recently, we're done in microseconds.   beat 3
```

A shape is timed by appending `|n`:

```
stk ... |2
```

Forms:

- `|3` — drawn on beat three
- `|3+` — drawn on beat three, and stays emphasised through the beats that follow
- `|+` — the next beat after the last shape that was anchored. Lets you walk a
  scene without counting
- no anchor — placed between its anchored neighbours, as in Chalk

**A beat number past the end of the narration is a build error.** So is two
shapes claiming the same beat, unless you say you meant it:

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
--- 7
  # 1 Step one: your computer checks its own memory.
  # 2 Browser cache first, then the operating system's.
  # 3 If it looked this up recently, we're done in microseconds.

stk ~cache |1
  BROWSER CACHE — checked first |1
  OPERATING SYSTEM CACHE |2
  then out to the network |3
```

---

## 3. Kinds

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
img <query>   a photograph of a real thing. Query ends in "photograph"
sym <name>    a line-art symbol from the published set (§9)
ico <emoji>   one emoji
label         a heading with a rule under it
callout       one loose statement per scene, no more (§8)
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

Everything after `kind` is optional. ` / ` inside text is a line break.

---

## 4. Containment

Indent two spaces and a line goes inside the line above it. The container sizes
itself and grids its contents. This worked in Chalk and is unchanged.

```
box #os OPERATING SYSTEM ~system |2
  box Scheduler |3
  box Memory manager |4
  box Filesystem |5

box HARDWARE ~inert |6
```

The container is drawn empty at full size and fills as each part arrives, so
give the indented lines their own beats when you name them one at a time.

Nests as deep as needed. Two spaces to a level.

---

## 5. Blocks take beats per row

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
  MX    | where to deliver email    | mail.example.com  |5
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

In Chalk a six-row table was one shape on one beat: the voice walked six items
while the board sat finished. That was the largest single loss of quality in the
language, and it was a syntax problem, not an authoring one.

---

## 6. Arrows, and what they do to the layout

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

Say what leads to what and let that arrange the board. Never write coordinates.

---

## 7. Pointing at what is already there

When the narration names something already on the board, do not draw it twice.
Point at it. All three take a target name and a beat, so you can point at
anything, anywhere on the board, at any time:

```
ring #tld |6         circle it
hl #tld |6           highlight it
dim #vm |7           push it back — for the thing being superseded
```

Targets can be a row inside a block:

```
hl #records.3 |5     the third row of the table named #records
hl #stack.top |4     the top layer
```

This is what a person at a whiteboard actually does. They do not redraw the
diagram to add a word; they tap it. Chalk could only tap the line it had just
drawn.

---

## 8. Text has to attach

`callout` is the only free-floating lettering, **one per scene**, for the one
thing the scene is really claiming.

Everything else attaches:

```
box #image IMAGE / read-only template ~template |2
  box frozen filesystem |3
  box startup instructions |4
  txt never changes once built / shared by every container |5
```

An indented `txt` is set at full width under whatever else is in the box — a
list about the box, not a cell in it. Use it for properties, guarantees,
caveats: anything *about* the box rather than *part of* it.

To attach a remark to a shape from elsewhere on the board:

```
note #ttl lowered before a migration, raised after |7
```

A `txt` at the top level is a build error. Chalk's "at most three loose lines a
scene" was prose compensating for a syntax that made a noticeboard the easiest
thing to build.

---

## 9. Symbols

`sym` draws from a closed, published set. An unknown name is a build error
listing the near misses, not a silent gap on the board.

```
processor  memory chip  disk  server  router  switch  cable  antenna
database   cache        queue  file    folder  key     padlock  shield
person     people       clock  stopwatch  hourglass  calendar
globe      map          signpost  compass  tree    layers   scales
envelope   document     receipt   phone     browser window   terminal
gear       wrench       lever     valve     pipe    turbine  battery
kidney     heart        lung      neuron    cell    dna      leaf
```

Run `slate syms <word>` for the current set. Two to four to a scene; a second
symbol of something already drawn is one of the lint failures below.

---

## 10. Colour is a role, not a colour

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

## 11. What the linter checks

The rules Chalk stated in prose and hoped for. `slate check` fails on:

- an anchor past the last beat of its scene
- two shapes on one beat without `*`, counting only the kinds that carry the
  argument: containers, structures, `code`, `callout`. A `sym` beside the box it
  illustrates, or an `img` under a callout, is the same thing drawn rather than
  a second thing to read, and may share a beat freely
- a `~role` that was never declared
- a `sym` name outside the set
- a top-level `txt`, or a second `callout`
- a name pointed at by `->`, `hl`, `ring`, `dim` or `note` that does not exist
- a `carry` of a name the previous scene never defined

And warns on:

- more than thirteen shapes in a scene, or fewer than four
- no `img`, or more than one
- fewer than two or more than four `sym`
- a run of three or more beats with nothing drawn on them — the board has
  stalled and the voice is talking to a still picture
- half or more of the beats empty
- a shape whose text repeats its container's label
- a literal colour where a role would do
- a declared name never referenced

The counts are a ceiling, not a target. A scene that says what it needs in seven
shapes is finished at seven.

---

## 12. Scenes that continue

```
--- 5
carry #tld #sld
box #reg THE REGISTERED NAME [example] ~name |4
```

`carry` brings named shapes forward from the previous scene. They appear at beat
zero, already drawn, dimmed, in their previous arrangement; new shapes lay out
around them. `carry all` takes everything.

`recall #name` reaches further back, to any scene in the lesson.

This is what makes a sequence feel like one lecture instead of fifteen posters.
The DNS hierarchy — root, TLD, second level, registered name, subdomain — is one
diagram assembled across three scenes, not three diagrams of the same thing.

---

## 13. How to draw a scene

In this order, every time:

1. **Say what the scene claims**, to yourself, in one sentence. That sentence is
   the scene. Anything belonging to the next point belongs to the next scene.
2. **Pull out the concrete things** — names, numbers, parts, steps, the
   comparison. Those become shapes. The rest is talk, and the voice carries it.
3. **Pick the one structure that fits.** Layers → `stk`. A sequence → a chain.
   Parts of a whole → indentation. Values worth comparing → `tbl` or `chart`.
   Two cases → two rows, one green, one red. Most scenes have one structure and
   a little detail around it.
4. **Walk the beats from one to the last** and hand each shape the beat where it
   is actually mentioned. If two shapes have no separate beat between them, one
   of them is a shape you do not need.
5. **Write rows top to bottom** in the order the beats arrive. A scene reads
   like a page.
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

## 14. Worked scene

Narration, fixed:

> Step three: the resolver asks a root server. There are thirteen root server
> addresses worldwide. The root doesn't know where example.com lives — but it
> knows who handles .com, and it says so. Step four: the resolver asks the .com
> TLD server. That server doesn't have the final answer either, but it knows
> which nameservers are authoritative for example.com. It points the way.

```
--- 8
carry #resolver

box #root ROOT SERVER [13 addresses worldwide] ~resolver |1
-> resolver root : where is example.com? |1*
note #root no idea where example.com lives — but it knows who does |3

box #tld .COM TLD SERVER ~resolver |4
-> root tld : ask the .com servers |3
box #auth AUTHORITATIVE NAMESERVERS / for example.com ~address |6
-> tld auth : it points the way |7

sym compass |7
sym card index |5
img root server room rack photograph |5

callout four questions, and only the last one knows the answer ~inert |7
```

Seven beats, ten shapes, nothing drawn twice, and every beat has something
arriving. `#resolver` was already on the board from scene seven; the scene adds
to it rather than redrawing it.

---

## Card

```
= title                          : takeaway              ~ role colour
--- n                            say <sentence>          one line, one beat

kind #name TEXT [stat] ~role |beat
  indented line                  goes inside the line above

box actor step choice store      containers
stk arr tbl chart code           structures — block form, one beat per row
img sym ico label callout        media and lettering
txt note                         attached text only

-> a b : label |beat             flow, chain, layout
--> <->                          dashed, both ways
hl ring dim #target |beat        point at what is there
note #target text |beat          a remark on a shape
carry #a #b   recall #a          bring shapes forward

|3   |3+   |+   |3*              a beat, held, next, shared
blank line                       ends a row
```

Never write a size, a position or a coordinate. They are worked out for you.
