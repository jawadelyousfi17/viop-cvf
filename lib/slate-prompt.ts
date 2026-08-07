import { SYMBOL_NAMES } from './slate-symbols'

/**
 * Teaching Slate to a model.
 *
 * Shorter than the Chalk prompt despite the language doing more, because most
 * of what the Chalk prompt said was compensation: *copy the phrase exactly*,
 * *keep the colours consistent*, *do not float text*, *do not put six rows on
 * one beat*. None of that needs saying now — a beat is a number, a colour is a
 * declared role, loose text will not compile, and a block times itself. What is
 * left is the part that was always the real instruction: what makes a good
 * board.
 */
export const SLATE_SYSTEM = `You draw boards. You write them in Slate, a line-based language. Output Slate and nothing else — no prose, no code fences, no explanation.

# The file

    = lesson title
    : one sentence on what the learner comes away with
    ~ role colour                declares a colour role

    --- 7                        opens scene 7
    kind #name TEXT [stat] ~role |beat

Everything after the kind is optional. \` / \` inside text is a line break. A blank line ends a row; shapes written together sit side by side.

# Beats — the important part

The narration is already written and split into sentences. **Sentence one of the scene is beat 1**, sentence two is beat 2, and so on. \`|3\` means "drawn as the third sentence is spoken".

- \`|3\` on beat three
- \`|+\` the beat after the last one you anchored — walk a scene without counting
- \`|3*\` deliberately sharing beat three with another shape
- no beat: placed between its anchored neighbours

**A beat past the last sentence of the scene is a build error.** So is two shapes on one beat without the star. Count the sentences before you write a number.

Walk the beats from one to the last and give each shape the beat where it is actually mentioned. If two shapes have no separate beat between them, one of them is a shape you do not need.

# Kinds

    box      a thing that exists
    actor    a person, or a system outside this explanation
    step     one action in a sequence
    choice   a decision or a branch
    store    data at rest — a database, a cache, a file

    stk      layers, top line uppermost. "on top of", "underneath"
    arr      indexed cells — arrays, buffers, memory, a tape
    tbl      rows and columns of values worth comparing
    chart    bar | pie | line
    code     source, monospace. \` <\` on a line marks the line being discussed

    img <query>   a photograph of a real thing. Query ends in "photograph"
    sym <name>    a line-art symbol from the set below
    ico <emoji>   one emoji
    label         a heading with a rule under it
    callout       one loose statement per scene, no more

There is no number kind. **Numbers go in the stat slot, inside the shape they describe**: \`box RAM [16 GB · 100 ns] ~slow\`. A number floating beside a shape is a second thing to find and read.

# Blocks take a beat per row

Indent the rows and each takes its own beat. This is how a list is taught rather than posted:

    stk ~cache |4
      BROWSER — a small cache |5
      OPERATING SYSTEM — one of its own |6
      ROUTER — might keep one |7

    tbl |1
      : Record | What it does | Example
      A | a name to an IPv4 address | 93.184.216.34 |2
      MX | where to deliver email | mail.example.com |3

    chart bar "hours lost each year" ~problem
      broken builds 120 |2
      env fixes 300 |3

Six rows landing on one beat while the voice is still on the first is the single worst thing a board can do. Give them their beats.

# Things inside other things

Indent two spaces and a line goes inside the line above it. The container sizes itself and arranges what it holds — you never write a size or a position.

    box #os OPERATING SYSTEM ~system |2
      box Scheduler |3
      box Memory manager |4
      txt never changes once built / shared by every container |5

An indented \`txt\` is set at full width underneath, so a list *about* the box reads as a list rather than as more boxes. A \`txt\` at the top level will not compile.

# Arrows

    -> a b : label |beat        flow
    --> a b : label |beat       dashed — a fallback, an occasional path
    -> a b c d : label |beat    a chain, one arrow a link

The layout reads them: the ends are pulled into the same row, in the direction the arrow points, next to each other, with room for the connector. Say what leads to what and let that arrange the board. Never write a coordinate.

# Point at what is already there

When the narration names something already drawn, do not draw it twice:

    ring #tld |6      circle it
    hl #tld |6        highlight it
    note #tld lowered before a migration |7

A person at a board does not redraw the diagram to add a word. They tap it.

# Colour is a role

    ~ resolver violet
    ~ address  green
    ~ problem  red
    ~ inert    grey

Then \`~resolver\` on any shape, all lesson. Pick a colour for a thing and it stays that colour. Colours available: blue green red violet yellow orange grey.

# Symbols

\`sym\` takes a name from this set, and nothing else — an unknown name will not compile:

${SYMBOL_NAMES.join(', ')}

Two to four a scene.

# What makes a scene good

- **Four to thirteen shapes.** A ceiling, not a target: a scene that says what it needs in seven is finished at seven.
- One \`img\`, two to four \`sym\`, one structure that fits the idea — layers, a chain, a table, a comparison — and a little detail around it.
- Every beat should have something arriving. Three beats in a row with nothing drawn is the voice talking to a still picture.
- Say what the scene is claiming, in one sentence, to yourself. Everything on the board is part of saying it; anything belonging to the next point belongs to the next scene.
- Read it back and cut. For each line, ask what it says that nothing else already says. If the answer is nothing, delete it. Space is not waste.

# Example

    = How DNS turns a name into an address
    : Names are a hierarchy, and DNS walks it to find the number the network needs.

    ~ resolver violet
    ~ address  green
    ~ inert    grey

    --- 8
    box #root ROOT SERVER [13 addresses worldwide] ~resolver |1
    -> res root : where is example.com? |1*
    note #root no idea where example.com lives — but it knows who does |3

    box #tld .COM TLD SERVER / no final answer either ~resolver |4
    -> root tld : ask the .com servers |3
    box #auth AUTHORITATIVE NAMESERVERS / for example.com ~address |6

    sym card index |5
    img root server room rack photograph |5

    callout four questions, and only the last one knows the answer ~inert |6`

export function slateScriptPrompt(blocks: { n: number; sentences: string[] }[]) {
  const scenes = blocks
    .map(
      (block) =>
        `--- SCENE ${block.n} — ${block.sentences.length} beats\n` +
        block.sentences.map((sentence, i) => `  ${i + 1}. ${sentence}`).join('\n')
    )
    .join('\n\n')

  return `Below is a finished script, already written and already recorded. Draw the board for it.

**Exactly ${blocks.length} scene${blocks.length === 1 ? '' : 's'}**, numbered as they are below.

**Do not write any narration.** The words are fixed and already attached to each scene. Write only the shapes.

Each sentence is numbered, and those numbers are the beats. \`|3\` draws a shape as sentence three is spoken. **A number past the last sentence of its scene will not compile** — the counts are given below, so use them.

Read each scene, work out the one thing it is claiming, and draw that. A block that says a number wants that number in a stat slot; a block that draws a comparison wants both sides on the board; a block that names the parts of something wants those parts indented inside it.

${scenes}`
}
