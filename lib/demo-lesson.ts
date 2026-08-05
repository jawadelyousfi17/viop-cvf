import type { BoardShape, Lesson } from './lesson'

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
    font: 'draw',
    anchor: '',
    points: [],
    ...shape,
  }
}

/**
 * A hand-written lesson in exactly the shape the model produces. Loaded at
 * `/?demo=1` so the board, camera, timing and every shape kind can be
 * exercised without an API key — and so the prompt has a concrete target.
 */
export const DEMO_LESSON: Lesson = {
  title: 'Why your CPU has a cache',
  summary: 'Memory is slow, so the CPU keeps a small, fast copy of what it just touched.',
  scenes: [
    {
      id: 'scene-1',
      heading: 'The processor waits',
      narration:
        'Your processor can do a few billion things per second. Main memory answers in about a hundred nanoseconds. In the time one answer comes back, the processor could have done three hundred more things. So most of the time, it is simply waiting.',
      shapes: [
        s({ id: 'h1', kind: 'text', text: 'The processor waits', x: 60, y: 50, w: 700, h: 70, size: 'xl', at: 0 }),
        s({ id: 'cpu', kind: 'box', text: 'CPU\n~0.3 ns per step', x: 90, y: 260, w: 300, h: 180, at: 0.15, anchor: 'a few billion things' }),
        s({ id: 'ram', kind: 'box', text: 'Main memory\n~100 ns per fetch', x: 830, y: 260, w: 300, h: 180, color: 'blue', at: 0.4, anchor: 'hundred nanoseconds' }),
        s({ id: 'wire', kind: 'arrow', text: '300 steps', x: 400, y: 350, w: 420, h: 0, from: 'cpu', to: 'ram', color: 'red', at: 0.62, anchor: 'three hundred more' }),
        s({ id: 'note1', kind: 'note', text: 'This gap is the whole reason caches exist.', x: 500, y: 540, w: 200, h: 200, color: 'yellow', size: 's', at: 0.85 }),
      ],
    },
    {
      id: 'scene-2',
      heading: 'Put a small fast copy nearby',
      narration:
        'The fix is to keep a small, very fast copy of memory right next to the core. That is the cache. It is tiny, but it sits so close that an answer comes back in about one nanosecond instead of a hundred.',
      shapes: [
        s({ id: 'h2', kind: 'text', text: 'Put a small fast copy nearby', x: 60, y: 50, w: 800, h: 70, size: 'xl', at: 0 }),
        s({ id: 'core', kind: 'box', text: 'Core', x: 80, y: 300, w: 200, h: 150, at: 0.12 }),
        s({ id: 'l1', kind: 'box', text: 'L1 cache\n32 KB · ~1 ns', x: 520, y: 300, w: 260, h: 150, color: 'green', fill: 'semi', at: 0.35, anchor: 'That is the cache' }),
        s({ id: 'mem', kind: 'box', text: 'Main memory\n16 GB · ~100 ns', x: 1020, y: 300, w: 300, h: 150, color: 'blue', at: 0.55 }),
        s({ id: 'a1', kind: 'arrow', x: 280, y: 375, w: 240, h: 0, from: 'core', to: 'l1', at: 0.7 }),
        s({ id: 'a2', kind: 'arrow', text: 'on a miss', x: 780, y: 375, w: 240, h: 0, from: 'l1', to: 'mem', color: 'grey', dash: 'dashed', at: 0.85 }),
        s({ id: 'mark', kind: 'highlight', color: 'yellow', size: 'l', at: 0.9, points: [{ x: 530, y: 375 }, { x: 770, y: 375 }] }),
      ],
    },
    {
      id: 'scene-3',
      heading: 'Hit rate is what matters',
      narration:
        'A cache only helps if you keep finding what you need in it. Plot average access time against hit rate and the curve is brutally steep. At ninety percent you are still paying ten nanoseconds on average. At ninety-nine percent you are paying two.',
      shapes: [
        s({ id: 'h3', kind: 'text', text: 'Hit rate is what matters', x: 60, y: 50, w: 700, h: 70, size: 'xl', at: 0 }),
        s({ id: 'axis', kind: 'axes', color: 'grey', x: 200, y: 200, w: 700, h: 400, at: 0.15 }),
        s({ id: 'ylab', kind: 'text', text: 'avg ns', x: 90, y: 180, w: 120, h: 40, size: 's', color: 'grey', at: 0.15 }),
        s({ id: 'xlab', kind: 'text', text: 'hit rate', x: 800, y: 620, w: 140, h: 40, size: 's', color: 'grey', at: 0.15 }),
        s({
          id: 'curve', kind: 'curve', color: 'red', size: 'm', at: 0.4, anchor: 'brutally steep',
          points: [
            { x: 220, y: 230 }, { x: 300, y: 300 }, { x: 380, y: 380 }, { x: 460, y: 445 },
            { x: 540, y: 495 }, { x: 620, y: 532 }, { x: 700, y: 558 }, { x: 780, y: 575 },
            { x: 860, y: 585 },
          ],
        }),
        s({ id: 'p90', kind: 'text', text: '90% → 10 ns', x: 620, y: 300, w: 240, h: 50, color: 'orange', at: 0.7, anchor: 'ninety percent' }),
        s({ id: 'p99', kind: 'text', text: '99% → 2 ns', x: 620, y: 370, w: 240, h: 50, color: 'green', at: 0.88, anchor: 'ninety-nine percent' }),
      ],
    },
    {
      id: 'scene-4',
      heading: 'Why it works',
      narration:
        'A cache would be useless if your next request were random. It works because real programs are predictable: they touch the same data again soon, and they touch neighbouring data next. Those two habits have names.',
      shapes: [
        s({ id: 'h4', kind: 'text', text: 'Why it works', x: 60, y: 50, w: 700, h: 70, size: 'xl', at: 0 }),
        s({ id: 'temporal', kind: 'ellipse', text: 'Temporal locality\nyou will want it again', x: 110, y: 250, w: 400, h: 220, color: 'violet', fill: 'semi', at: 0.25, anchor: 'same data again' }),
        s({ id: 'spatial', kind: 'ellipse', text: 'Spatial locality\nyou will want its neighbour', x: 640, y: 250, w: 420, h: 220, color: 'orange', fill: 'semi', at: 0.55, anchor: 'neighbouring data' }),
        s({ id: 'arr', kind: 'array', text: '42|17|8|99|3|61', x: 200, y: 540, w: 660, h: 110, color: 'orange', at: 0.75, anchor: 'neighbouring data' }),
        s({ id: 'bars', kind: 'bars', text: 'L1|1\nL2|4\nL3|12\nRAM|100', x: 940, y: 500, w: 300, h: 200, color: 'blue', at: 0.9 }),
      ],
    },
    {
      id: 'scene-5',
      heading: 'Ninety-five percent is enough',
      narration:
        'Put it together. Ninety-five times out of a hundred the data is already in the cache, and only the rest pay the long trip to memory. That single ratio is why a small, cheap piece of fast memory buys you most of the speed of a huge one.',
      shapes: [
        s({ id: 'h5', kind: 'text', text: 'Ninety-five percent is enough', x: 60, y: 50, w: 800, h: 70, size: 'xl', at: 0 }),
        s({ id: 'req', kind: 'ellipse', text: 'a read', x: 60, y: 330, w: 200, h: 120, at: 0.1 }),
        s({ id: 'check', kind: 'diamond', text: 'in cache?', x: 500, y: 290, w: 240, h: 200, at: 0.25 }),
        s({ id: 'hit', kind: 'box', text: 'hit · ~1 ns', x: 990, y: 190, w: 280, h: 120, color: 'green', fill: 'semi', at: 0.45 }),
        s({ id: 'miss', kind: 'box', text: 'miss · ~100 ns', x: 990, y: 470, w: 280, h: 120, color: 'red', at: 0.6 }),
        s({ id: 'e1', kind: 'arrow', x: 260, y: 390, w: 240, h: 0, from: 'req', to: 'check', at: 0.3 }),
        s({ id: 'e2', kind: 'arrow', text: '95%', x: 740, y: 340, w: 250, h: -70, from: 'check', to: 'hit', color: 'green', at: 0.75, anchor: 'Ninety-five times' }),
        s({ id: 'e3', kind: 'arrow', text: '5%', x: 740, y: 440, w: 250, h: 90, from: 'check', to: 'miss', color: 'red', at: 0.88, anchor: 'the rest pay' }),
      ],
    },
  ],
}
