import type { BoardShape, Lesson, Scene } from './lesson'

/** Fills the defaults so a demo shape only has to state what's interesting. */
function s(shape: Partial<BoardShape> & Pick<BoardShape, 'id' | 'kind' | 'at'>): BoardShape {
  return {
    text: '',
    x: 40,
    y: 40,
    w: 200,
    h: 100,
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
function scene(
  scene: Omit<Scene, 'diagram'> & Partial<Pick<Scene, 'diagram'>>
): Scene {
  return { diagram: { source: '', timing: [] }, ...scene }
}

/**
 * The demo lesson, at `/?demo=1`.
 *
 * Hand-written in exactly the shape the model produces, and doing three jobs at
 * once. It shows the board working without an API key. It gives the prompt a
 * concrete target — this is what a good scene looks like. And it is the thing
 * you put in front of someone when you have thirty seconds to show them what
 * this is, which is why it deliberately works through every capability the
 * board has rather than only the ones a given topic would reach for:
 *
 *   scene 1  the hook — a bar chart, an icon row, a red annotation
 *   scene 2  a `stack` composite, a photograph, a laser sweep
 *   scene 3  a Mermaid flowchart laid out by dagre, traced with the laser
 *   scene 4  an `array` composite, icons, a curve, a sticky note
 *   scene 5  a line chart, a ring, the red/green annotation pass
 *   scene 6  a `table`, a pie chart, the payoff
 *
 * Caching is the topic because it is the rare subject that genuinely wants all
 * of them: hard numbers, a hierarchy, a decision, a sequence in memory, a
 * curve, and a ratio.
 *
 * Every `anchor` below appears verbatim in its scene's narration. That is what
 * makes the drawing land on the word rather than near it, and it is the first
 * thing to check if a change here makes the demo feel loose.
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
        'Your processor does something every third of a nanosecond. [curious] Main memory takes about a hundred nanoseconds to answer. So in the time one value arrives, the core could have finished three hundred more steps. It is not slow because it is thinking. It is waiting.',
      shapes: [
        s({ id: 'k1', kind: 'label', text: 'THE PROCESSOR', x: 90, y: 60, w: 420, h: 70, size: 'l', at: 0, anchor: 'Your processor does something' }),
        s({ id: 'i1', kind: 'icon', text: '⚡', x: 560, y: 55, w: 120, h: 120, at: 0.05, anchor: 'Your processor does something' }),
        s({ id: 'k2', kind: 'text', text: '0.3 ns per step', x: 730, y: 70, w: 380, h: 60, size: 'l', color: 'green', at: 0.09, anchor: 'every third of a nanosecond' }),

        s({ id: 'k3', kind: 'label', text: 'MAIN MEMORY', x: 90, y: 250, w: 400, h: 70, size: 'l', at: 0.24, anchor: 'Main memory takes about' }),
        s({ id: 'i2', kind: 'icon', text: '🧠', x: 560, y: 245, w: 120, h: 120, at: 0.28, anchor: 'Main memory takes about' }),
        s({ id: 'k4', kind: 'text', text: '100 ns per fetch', x: 730, y: 260, w: 380, h: 60, size: 'l', color: 'red', at: 0.33, anchor: 'a hundred nanoseconds to answer' }),

        s({
          id: 'gap', kind: 'barchart', text: 'nanoseconds to answer', color: 'blue',
          x: 120, y: 430, w: 620, h: 330, at: 0.52, anchor: 'three hundred more steps',
          data: [
            { label: 'one step', value: 0.3 },
            { label: 'L1 cache', value: 1 },
            { label: 'main memory', value: 100 },
          ],
        }),
        s({ id: 'ratio', kind: 'text', text: '300×', x: 830, y: 470, w: 260, h: 110, size: 'xl', color: 'red', at: 0.66, anchor: 'three hundred more steps' }),
        s({ id: 'ann1', kind: 'text', text: 'this gap is the whole problem', x: 810, y: 600, w: 400, h: 60, size: 's', color: 'red', at: 0.8, anchor: 'It is waiting' }),
        s({ id: 'mark1', kind: 'highlight', color: 'yellow', size: 'l', at: 0.9, anchor: 'It is waiting', points: [{ x: 830, y: 500 }, { x: 1080, y: 500 }] }),
      ],
    }),

    scene({
      id: 'scene-1',
      heading: '',
      narration:
        'The fix is a hierarchy. Right beside the core sits a tiny, very fast copy called L1, about thirty-two kilobytes. Below it, larger and slower caches. At the bottom, sixteen gigabytes of main memory. Each level down is roughly ten times bigger and ten times slower.',
      shapes: [
        s({ id: 'h1', kind: 'label', text: 'THE MEMORY HIERARCHY', x: 90, y: 60, w: 620, h: 70, size: 'l', at: 0, anchor: 'The fix is a hierarchy' }),
        s({
          id: 'stack', kind: 'stack',
          text: 'L1 · 32 KB · 1 ns\nL2 · 512 KB · 4 ns\nL3 · 32 MB · 12 ns\nMain memory · 16 GB · 100 ns',
          x: 90, y: 210, w: 700, h: 420, color: 'blue', at: 0.18, anchor: 'Right beside the core',
        }),
        s({ id: 'img1', kind: 'image', text: 'DDR4 DRAM memory module photograph', x: 880, y: 210, w: 520, h: 340, at: 0.3, anchor: 'about thirty-two kilobytes' }),
        s({ id: 'cap1', kind: 'text', text: 'the slow one, in the flesh', x: 890, y: 570, w: 400, h: 50, size: 's', color: 'grey', at: 0.62, anchor: 'sixteen gigabytes of main memory' }),
        s({ id: 'rule', kind: 'text', text: 'each level: ×10 bigger, ×10 slower', x: 90, y: 680, w: 700, h: 60, size: 'l', color: 'violet', at: 0.78, anchor: 'ten times bigger and ten times slower' }),
        s({ id: 'sweep', kind: 'laser', color: 'red', size: 'm', at: 0.88, anchor: 'ten times bigger and ten times slower', points: [{ x: 200, y: 250 }, { x: 200, y: 400 }, { x: 200, y: 560 }] }),
      ],
    }),

    scene({
      id: 'scene-2',
      heading: '',
      narration:
        'So what happens on a read? The core asks L1 first. If the line is there, that is a hit, and the value comes back in one nanosecond. If it is not, that is a miss, and the request goes down the hierarchy until something has it. A miss costs you the whole hundred nanoseconds.',
      diagram: {
        source: `flowchart TD
  CORE([Core wants a value]) --> L1{In L1?}
  L1 -->|hit, 1 ns| FAST([Return it])
  L1 -->|miss| DEEP[Try L2, then L3]
  DEEP -.->|still missing| RAM((Main memory))`,
        timing: [
          { node: 'CORE', anchor: 'The core asks L1 first', at: 0.18 },
          { node: 'L1', anchor: 'The core asks L1 first', at: 0.24 },
          { node: 'FAST', anchor: 'that is a hit', at: 0.4 },
          { node: 'DEEP', anchor: 'that is a miss', at: 0.6 },
          { node: 'RAM', anchor: 'down the hierarchy', at: 0.72 },
        ],
      },
      shapes: [
        s({ id: 'h2', kind: 'label', text: 'ONE READ', x: 90, y: 60, w: 360, h: 70, size: 'l', at: 0, anchor: 'So what happens on a read' }),
        s({ id: 'hit', kind: 'text', text: 'hit → 1 ns', x: 1050, y: 240, w: 320, h: 60, size: 'l', color: 'green', at: 0.46, anchor: 'in one nanosecond' }),
        s({ id: 'miss', kind: 'text', text: 'miss → 100 ns', x: 1050, y: 330, w: 340, h: 60, size: 'l', color: 'red', at: 0.86, anchor: 'the whole hundred nanoseconds' }),
        s({ id: 'note1', kind: 'note', text: 'A miss does not just cost more. It costs 100×.', x: 1050, y: 450, w: 200, h: 200, color: 'yellow', size: 's', at: 0.92, anchor: 'the whole hundred nanoseconds' }),
      ],
    }),

    scene({
      id: 'scene-3',
      heading: '',
      narration:
        'None of this would work if your next read were random. It works because real programs repeat themselves. You touch the same variable again a moment later, and you touch its neighbour next. So the cache never fetches one byte — it fetches sixty-four at a time, a whole cache line.',
      shapes: [
        s({ id: 'h3', kind: 'label', text: 'WHY IT WORKS AT ALL', x: 90, y: 60, w: 560, h: 70, size: 'l', at: 0, anchor: 'None of this would work' }),

        s({ id: 'i3', kind: 'icon', text: '🔁', x: 120, y: 200, w: 120, h: 120, at: 0.24, anchor: 'real programs repeat themselves' }),
        s({ id: 't1', kind: 'label', text: 'TEMPORAL', x: 270, y: 210, w: 320, h: 60, color: 'violet', at: 0.28, anchor: 'the same variable again' }),
        s({ id: 't2', kind: 'text', text: 'you want it again soon', x: 270, y: 275, w: 380, h: 50, size: 's', color: 'grey', at: 0.34, anchor: 'the same variable again' }),

        s({ id: 'i4', kind: 'icon', text: '➡️', x: 760, y: 200, w: 120, h: 120, at: 0.44, anchor: 'you touch its neighbour next' }),
        s({ id: 't3', kind: 'label', text: 'SPATIAL', x: 910, y: 210, w: 300, h: 60, color: 'orange', at: 0.48, anchor: 'you touch its neighbour next' }),
        s({ id: 't4', kind: 'text', text: 'you want the one beside it', x: 910, y: 275, w: 400, h: 50, size: 's', color: 'grey', at: 0.52, anchor: 'you touch its neighbour next' }),

        s({ id: 'line', kind: 'array', text: '42|17|8|99|3|61|7|24', x: 200, y: 430, w: 900, h: 130, color: 'orange', at: 0.7, anchor: 'it fetches sixty-four at a time' }),
        s({ id: 'cl', kind: 'text', text: 'one cache line · 64 bytes', x: 200, y: 610, w: 500, h: 60, size: 'l', color: 'orange', at: 0.84, anchor: 'a whole cache line' }),
        s({ id: 'brace', kind: 'curve', color: 'orange', size: 'm', at: 0.88, anchor: 'a whole cache line', points: [{ x: 210, y: 580 }, { x: 500, y: 596 }, { x: 800, y: 596 }, { x: 1090, y: 580 }] }),
      ],
    }),

    scene({
      id: 'scene-4',
      heading: '',
      narration:
        'Now the number that decides everything: the hit rate. Plot the average time against it and the curve is brutal. At ninety percent you are still paying eleven nanoseconds. You have to reach ninety-nine percent before the average drops to two. Almost all of the benefit lives in that last stretch.',
      shapes: [
        s({ id: 'h4', kind: 'label', text: 'THE HIT RATE', x: 90, y: 60, w: 420, h: 70, size: 'l', at: 0, anchor: 'the hit rate' }),
        s({
          id: 'curve', kind: 'linechart', text: 'average nanoseconds by hit rate', color: 'blue',
          x: 90, y: 190, w: 760, h: 430, at: 0.18, anchor: 'Plot the average time',
          data: [
            { label: '50%', value: 51 },
            { label: '80%', value: 21 },
            { label: '90%', value: 11 },
            { label: '95%', value: 6 },
            { label: '99%', value: 2 },
          ],
        }),
        s({ id: 'p90', kind: 'text', text: '90% → 11 ns', x: 950, y: 240, w: 340, h: 60, size: 'l', color: 'orange', at: 0.46, anchor: 'still paying eleven nanoseconds' }),
        s({ id: 'p99', kind: 'text', text: '99% → 2 ns', x: 950, y: 330, w: 340, h: 60, size: 'l', color: 'green', at: 0.68, anchor: 'the average drops to two' }),
        s({ id: 'ring1', kind: 'ring', color: 'green', x: 935, y: 315, w: 380, h: 95, at: 0.74, anchor: 'the average drops to two' }),
        s({ id: 'ann2', kind: 'text', text: 'the whole game is here', x: 950, y: 440, w: 380, h: 50, size: 's', color: 'green', at: 0.86, anchor: 'in that last stretch' }),
        s({ id: 'ann3', kind: 'text', text: 'ninety percent is not good enough', x: 950, y: 510, w: 400, h: 50, size: 's', color: 'red', at: 0.92, anchor: 'in that last stretch' }),
      ],
    }),

    scene({
      id: 'scene-5',
      heading: '',
      narration:
        'Put it together. On real code the cache answers about ninety-five reads in every hundred, and only the other five pay the long trip. That is why a few megabytes of expensive memory buys you most of the speed of sixteen gigabytes of cheap memory. The whole trick is that programs repeat themselves.',
      shapes: [
        s({ id: 'h5', kind: 'label', text: 'WHAT IT BUYS YOU', x: 90, y: 60, w: 520, h: 70, size: 'l', at: 0, anchor: 'Put it together' }),
        s({
          id: 'split', kind: 'piechart', text: 'where a read is answered', color: 'green',
          x: 90, y: 200, w: 520, h: 400, at: 0.22, anchor: 'ninety-five reads in every hundred',
          data: [
            { label: 'cache hit', value: 95 },
            { label: 'miss', value: 5 },
          ],
        }),
        s({
          id: 'tbl', kind: 'table',
          text: 'Level|Size|Time|Share of reads\nL1 cache|32 KB|1 ns|95%\nMain memory|16 GB|100 ns|5%',
          x: 700, y: 210, w: 700, h: 240, at: 0.46, anchor: 'only the other five pay',
        }),
        s({ id: 'pay', kind: 'text', text: 'average: about 6 ns', x: 700, y: 500, w: 480, h: 70, size: 'xl', color: 'green', at: 0.68, anchor: 'most of the speed' }),
        s({ id: 'end', kind: 'text', text: 'because programs repeat themselves', x: 700, y: 600, w: 620, h: 60, size: 'l', color: 'violet', at: 0.88, anchor: 'programs repeat themselves' }),
        s({ id: 'mark2', kind: 'highlight', color: 'green', size: 'l', at: 0.94, anchor: 'programs repeat themselves', points: [{ x: 710, y: 630 }, { x: 1200, y: 630 }] }),
      ],
    }),
  ],
}
