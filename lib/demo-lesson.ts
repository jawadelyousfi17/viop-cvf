import type { BoardShape, Lesson, Scene } from './lesson'

/** Fills the defaults so a demo shape only has to state what's interesting. */
function s(shape: Partial<BoardShape> & Pick<BoardShape, 'id' | 'kind' | 'at'>): BoardShape {
  return {
    text: '',
    x: 60,
    y: 60,
    w: 300,
    h: 120,
    from: null,
    to: null,
    color: 'black',
    fill: 'none',
    size: 'm',
    dash: 'draw',
    anchor: '',
    points: [],
    data: [],
    ...shape,
  }
}

/** A scene with no Mermaid diagram, which is most of them. */
function scene(scene: Omit<Scene, 'diagram'> & Partial<Pick<Scene, 'diagram'>>): Scene {
  return { diagram: { source: '', timing: [] }, ...scene }
}

/**
 * The demo lesson, at `/?demo=1`.
 *
 * Three jobs at once. It proves the board works without an API key. It gives
 * the prompt a concrete target — this is what a good scene looks like. And it
 * is the thing you put in front of a person when you have a minute to show
 * them what this is, which is why it deliberately works through every
 * capability rather than only the ones the topic would reach for:
 *
 *   scene 1  tinted category boxes, their shadows, a two-tier arrow label
 *   scene 2  the `stack` composite, a photograph, a ring round the rule
 *   scene 3  a Mermaid flowchart laid out by dagre, a sticky note
 *   scene 4  a dashed grouping frame around the `array` composite, a brace
 *   scene 5  a line chart, a ring thrown around the number that matters
 *   scene 6  a `table`, a pie chart, the red/green annotation pass
 *
 * Caching is the subject because it is the rare topic that genuinely wants all
 * of them: hard numbers, a hierarchy, a decision, a run of neighbouring bytes,
 * a curve, and a ratio.
 *
 * Two rules hold the whole thing together, and both are worth preserving
 * through any edit.
 *
 * **Colour is a category, not decoration.** light-blue is the processor side,
 * yellow is storage, light-red is the slow path, light-violet is a decision,
 * green is the good outcome. The same meaning holds in every scene, so the
 * board can be read by colour before it is read by word.
 *
 * **Every anchor is verbatim.** Each string in an `anchor` appears character
 * for character in that scene's narration, which is what makes a shape land on
 * its word instead of near it. If an edit here makes the demo feel loose, that
 * is the first thing to check.
 */
export const DEMO_LESSON: Lesson = {
  title: 'Why your CPU has a cache',
  summary:
    'Memory is a hundred times slower than the processor, so the CPU keeps a small, fast copy of whatever it just touched — and because real programs repeat themselves, that copy answers about ninety-five percent of reads.',
  scenes: [
    scene({
      id: 'scene-0',
      heading: '',
      narration:
        'Your processor does something every third of a nanosecond. [curious] Main memory takes about a hundred nanoseconds to answer. So in the time one value comes back, the core could have finished three hundred more steps. It is not slow because it is thinking. It is waiting.',
      shapes: [
        // Row one: the two ends of the problem, in the colours they keep for
        // the rest of the lesson — blue for the processor side, yellow for
        // anything that stores.
        s({ id: 'cpu', kind: 'box', text: 'PROCESSOR\n0.3 ns per step', x: 120, y: 200, w: 380, h: 150, color: 'light-blue', fill: 'semi', size: 'l', at: 0.01, anchor: 'Your processor does something' }),
        s({ id: 'link', kind: 'arrow', text: 'one value\nthree hundred steps wasted waiting for it', x: 520, y: 275, w: 420, h: 0, from: 'cpu', to: 'ram', color: 'red', at: 0.7, anchor: 'three hundred more steps' }),
        s({ id: 'ram', kind: 'box', text: 'MAIN MEMORY\n100 ns per fetch', x: 1180, y: 200, w: 380, h: 150, color: 'yellow', fill: 'semi', size: 'l', at: 0.32, anchor: 'a hundred nanoseconds to answer' }),

        // Row two: icons under each end, so the board reads as being about
        // something rather than about two rectangles.
        s({ id: 'i1', kind: 'icon', text: '⚡', x: 250, y: 400, w: 120, h: 120, at: 0.1, anchor: 'every third of a nanosecond' }),
        s({ id: 'i2', kind: 'icon', text: '🧠', x: 1310, y: 400, w: 120, h: 120, at: 0.24, anchor: 'Main memory takes about' }),

        // Row three: the thing itself, and the one number to take away.
        s({ id: 'img0', kind: 'image', text: 'computer processor silicon die close up photograph', x: 120, y: 580, w: 600, h: 320, at: 0.81, anchor: 'It is not slow because it is thinking' }),
        s({ id: 'ratio', kind: 'text', text: '300×', x: 820, y: 620, w: 320, h: 140, size: 'xl', color: 'red', at: 0.7, anchor: 'three hundred more steps' }),
        s({ id: 'ann1', kind: 'text', text: 'this gap is the whole problem', x: 1220, y: 640, w: 500, h: 60, size: 's', color: 'red', at: 0.95, anchor: 'It is waiting' }),
        s({ id: 'mark1', kind: 'highlight', color: 'yellow', size: 'l', at: 0.95, anchor: 'It is waiting', points: [{ x: 830, y: 700 }, { x: 1130, y: 700 }] }),

        // Row four: the measurement.
        s({
          id: 'gap', kind: 'barchart', text: 'nanoseconds to answer', color: 'blue',
          x: 120, y: 960, w: 900, h: 340, at: 0.48, anchor: 'in the time one value comes back',
          data: [
            { label: 'one step', value: 0.3 },
            { label: 'L1 cache', value: 1 },
            { label: 'main memory', value: 100 },
          ],
        }),
      ],
    }),

    scene({
      id: 'scene-1',
      heading: '',
      narration:
        'The fix is a hierarchy. Right beside the core sits a tiny, very fast copy called L1, about thirty-two kilobytes. Below it, larger and slower caches. At the bottom, sixteen gigabytes of main memory. Each level down is roughly ten times bigger and ten times slower.',
      shapes: [
        s({ id: 'h1', kind: 'label', text: 'THE MEMORY HIERARCHY', x: 120, y: 110, w: 700, h: 76, size: 'l', at: 0.01, anchor: 'The fix is a hierarchy' }),

        s({
          id: 'stack', kind: 'stack',
          text: 'L1 · 32 KB · 1 ns\nL2 · 512 KB · 4 ns\nL3 · 32 MB · 12 ns\nMain memory · 16 GB · 100 ns',
          x: 120, y: 280, w: 780, h: 460, color: 'blue', at: 0.11, anchor: 'Right beside the core',
        }),
        s({ id: 'img1', kind: 'image', text: 'DDR4 DRAM memory module photograph', x: 1020, y: 280, w: 600, h: 320, at: 0.36, anchor: 'about thirty-two kilobytes' }),
        s({ id: 'cap1', kind: 'text', text: 'the slow one, in the flesh', x: 1020, y: 620, w: 460, h: 56, size: 's', color: 'grey', at: 0.66, anchor: 'sixteen gigabytes of main memory' }),

        s({ id: 'rule', kind: 'text', text: 'each level down: ×10 bigger, ×10 slower', x: 120, y: 820, w: 900, h: 70, size: 'l', color: 'violet', at: 0.87, anchor: 'ten times bigger and ten times slower' }),
        // Thrown around the rule as it is said, which is what a hand does to
        // the line that matters.
        s({ id: 'ringrule', kind: 'ring', color: 'violet', x: 110, y: 810, w: 920, h: 90, at: 0.9, anchor: 'ten times bigger and ten times slower' }),
      ],
    }),

    scene({
      id: 'scene-2',
      heading: '',
      narration:
        'So what happens on a read? The core asks L1 first. If the line is already there, that is a hit, and the value comes back in one nanosecond. If it is not, that is a miss, and the request goes down the hierarchy until something has it. A miss costs the whole hundred nanoseconds.',
      diagram: {
        source: `flowchart TD
  CORE([Core wants a value]) --> L1{In L1?}
  L1 -->|hit, 1 ns| FAST([Return it])
  L1 -->|miss| DEEP[Try L2, then L3]
  DEEP -.->|still missing| RAM((Main memory))`,
        timing: [
          { node: 'CORE', anchor: 'The core asks L1 first', at: 0.11 },
          { node: 'L1', anchor: 'The core asks L1 first', at: 0.11 },
          { node: 'FAST', anchor: 'that is a hit', at: 0.32 },
          { node: 'DEEP', anchor: 'that is a miss', at: 0.6 },
          { node: 'RAM', anchor: 'down the hierarchy', at: 0.71 },
        ],
      },
      shapes: [
        s({ id: 'h2', kind: 'label', text: 'ONE READ', x: 120, y: 110, w: 400, h: 76, size: 'l', at: 0.01, anchor: 'So what happens on a read' }),

        s({ id: 'hit', kind: 'box', text: 'HIT\n1 ns', x: 1280, y: 300, w: 340, h: 140, color: 'light-green', fill: 'semi', size: 'l', at: 0.45, anchor: 'in one nanosecond' }),
        // Anchored to the moment a miss is named, not to the sentence that
        // prices it — otherwise the box arrives after the note about it.
        s({ id: 'miss', kind: 'box', text: 'MISS\n100 ns', x: 1280, y: 490, w: 340, h: 140, color: 'light-red', fill: 'semi', size: 'l', at: 0.6, anchor: 'that is a miss' }),
        s({ id: 'note1', kind: 'note', text: 'A miss does not cost a little more. It costs a hundred times more.', x: 1280, y: 690, w: 200, h: 200, color: 'yellow', size: 's', at: 0.91, anchor: 'the whole hundred nanoseconds' }),

        // A bottom row, so the diagram is not the only thing in the scene and
        // the board fills its height rather than sitting in a wide letterbox.
        s({ id: 'cost', kind: 'text', text: 'every miss buys 100 wasted steps', x: 120, y: 900, w: 760, h: 70, size: 'l', color: 'red', at: 0.87, anchor: 'A miss costs the whole hundred nanoseconds' }),
        s({ id: 'brace', kind: 'curve', color: 'red', size: 'm', at: 0.88, anchor: 'A miss costs the whole hundred nanoseconds', points: [{ x: 130, y: 975 }, { x: 400, y: 992 }, { x: 620, y: 992 }, { x: 870, y: 975 }] }),
      ],
    }),

    scene({
      id: 'scene-3',
      heading: '',
      narration:
        'None of this would work if your next read were random. It works because real programs repeat themselves. You touch the same variable again a moment later, and you touch its neighbour next. So the cache never fetches one byte — it fetches sixty-four at a time, a whole cache line.',
      shapes: [
        s({ id: 'h3', kind: 'label', text: 'WHY IT WORKS AT ALL', x: 120, y: 110, w: 620, h: 76, size: 'l', at: 0.01, anchor: 'None of this would work' }),

        // The two habits, side by side, each a tinted box with its icon.
        s({ id: 'i3', kind: 'icon', text: '🔁', x: 160, y: 260, w: 120, h: 120, at: 0.24, anchor: 'real programs repeat themselves' }),
        s({ id: 't1', kind: 'box', text: 'TEMPORAL\nyou want it again soon', x: 320, y: 250, w: 420, h: 140, color: 'light-violet', fill: 'semi', at: 0.41, anchor: 'the same variable again' }),
        s({ id: 'i4', kind: 'icon', text: '➡️', x: 900, y: 260, w: 120, h: 120, at: 0.56, anchor: 'you touch its neighbour next' }),
        s({ id: 't2', kind: 'box', text: 'SPATIAL\nyou want the one beside it', x: 1060, y: 250, w: 440, h: 140, color: 'orange', fill: 'semi', at: 0.56, anchor: 'you touch its neighbour next' }),

        // A dashed empty box around the array and its caption becomes a
        // labelled region: the frame is bound to what it encloses and the two
        // move together through the layout.
        s({ id: 'frame', kind: 'box', text: '', x: 200, y: 520, w: 1200, h: 340, color: 'grey', dash: 'dashed', at: 0.82, anchor: 'it fetches sixty-four at a time' }),
        s({ id: 'flab', kind: 'label', text: 'ONE CACHE LINE', x: 240, y: 550, w: 460, h: 70, color: 'orange', at: 0.82, anchor: 'it fetches sixty-four at a time' }),
        s({ id: 'line', kind: 'array', text: '42|17|8|99|3|61|7|24', x: 240, y: 650, w: 1120, h: 140, color: 'orange', at: 0.82, anchor: 'it fetches sixty-four at a time' }),

        s({ id: 'cl', kind: 'text', text: '64 bytes, every time', x: 200, y: 900, w: 560, h: 64, size: 'l', color: 'orange', at: 0.89, anchor: 'a whole cache line' }),
      ],
    }),

    scene({
      id: 'scene-4',
      heading: '',
      narration:
        'Now the number that decides everything: the hit rate. Plot the average time against it and the curve is brutal. At ninety percent you are still paying eleven nanoseconds. You have to reach ninety-nine percent before the average drops to two. Almost all of the benefit lives in that last stretch.',
      shapes: [
        s({ id: 'h4', kind: 'label', text: 'THE HIT RATE', x: 120, y: 110, w: 460, h: 76, size: 'l', at: 0.15, anchor: 'the hit rate' }),
        s({
          id: 'curve', kind: 'linechart', text: 'average nanoseconds by hit rate', color: 'blue',
          x: 120, y: 250, w: 860, h: 480, at: 0.21, anchor: 'Plot the average time',
          data: [
            { label: '50%', value: 51 },
            { label: '80%', value: 21 },
            { label: '90%', value: 11 },
            { label: '95%', value: 6 },
            { label: '99%', value: 2 },
          ],
        }),
        s({ id: 'p90', kind: 'box', text: '90% → 11 ns', x: 1100, y: 300, w: 400, h: 130, color: 'light-red', fill: 'semi', size: 'l', at: 0.48, anchor: 'still paying eleven nanoseconds' }),
        s({ id: 'p99', kind: 'box', text: '99% → 2 ns', x: 1100, y: 480, w: 400, h: 130, color: 'light-green', fill: 'semi', size: 'l', at: 0.72, anchor: 'the average drops to two' }),
        // Thrown around whichever shape it started nearest — which is p99.
        s({ id: 'ring1', kind: 'ring', color: 'green', x: 1090, y: 470, w: 420, h: 150, at: 0.73, anchor: 'the average drops to two' }),
        s({ id: 'ann2', kind: 'text', text: 'the whole game is in this last stretch', x: 1100, y: 680, w: 520, h: 60, size: 's', color: 'green', at: 0.93, anchor: 'in that last stretch' }),
        s({ id: 'ann3', kind: 'text', text: 'ninety percent is not good enough', x: 1100, y: 760, w: 520, h: 60, size: 's', color: 'red', at: 0.93, anchor: 'in that last stretch' }),
      ],
    }),

    scene({
      id: 'scene-5',
      heading: '',
      narration:
        'Put it together. On real code the cache answers about ninety-five reads in every hundred, and only the other five pay the long trip. That is why a few megabytes of expensive memory buys you most of the speed of sixteen gigabytes of cheap memory. The whole trick is that programs repeat themselves.',
      shapes: [
        s({ id: 'h5', kind: 'label', text: 'WHAT IT BUYS YOU', x: 120, y: 110, w: 560, h: 76, size: 'l', at: 0.01, anchor: 'Put it together' }),

        s({
          id: 'split', kind: 'piechart', text: 'where a read is answered', color: 'green',
          x: 120, y: 250, w: 620, h: 440, at: 0.20, anchor: 'ninety-five reads in every hundred',
        data: [
            { label: 'cache hit', value: 95 },
            { label: 'miss', value: 5 },
          ],
        }),
        s({
          id: 'tbl', kind: 'table',
          text: 'Level|Size|Time|Share of reads\nL1 cache|32 KB|1 ns|95%\nMain memory|16 GB|100 ns|5%',
          x: 840, y: 260, w: 800, h: 260, at: 0.33, anchor: 'only the other five pay',
        }),
        s({ id: 'pay', kind: 'box', text: 'average: about 6 ns', x: 840, y: 570, w: 560, h: 140, color: 'light-green', fill: 'semi', size: 'l', at: 0.66, anchor: 'most of the speed' }),

        s({ id: 'end', kind: 'text', text: 'because programs repeat themselves', x: 120, y: 800, w: 900, h: 70, size: 'l', color: 'violet', at: 0.91, anchor: 'programs repeat themselves' }),
        s({ id: 'mark2', kind: 'highlight', color: 'green', size: 'l', at: 0.92, anchor: 'programs repeat themselves', points: [{ x: 130, y: 845 }, { x: 900, y: 845 }] }),
      ],
    }),
  ],
}
