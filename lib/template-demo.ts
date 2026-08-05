import type { TemplateItem, TemplateLesson } from './template-lesson'

/** Fills item defaults so the demo only states what's interesting. */
function it(item: Partial<TemplateItem> & Pick<TemplateItem, 'heading' | 'at'>): TemplateItem {
  return { body: '', icon: '✦', anchor: '', image: '', ...item }
}

/**
 * A hand-written lesson exercising every template, in exactly the shape the
 * model produces. Loaded at `/?demo=1` so the renderer, reveal timing and
 * scene transitions can be checked without any API keys.
 */
export const DEMO_LESSON: TemplateLesson = {
  title: 'Why your CPU has a cache',
  summary: 'Memory is slow, so the CPU keeps a small, fast copy of what it just touched.',
  scenes: [
    {
      id: 'demo-hero',
      template: 'hero',
      title: 'The processor spends its life waiting',
      subtitle: 'A few billion operations a second, held up by memory a hundred nanoseconds away.',
      narration:
        'Your processor can do a few billion things every second. Main memory answers in about a hundred nanoseconds. In the time one answer comes back, the chip could have done three hundred more things — so most of its life is spent waiting.',
      image: 'computer processor CPU chip close up photograph',
      data: '',
      items: [
        it({ heading: 'Billions per second', icon: '⚡', anchor: 'few billion things', at: 0.25 }),
        it({ heading: '~100 ns to answer', icon: '🐢', anchor: 'hundred nanoseconds', at: 0.55 }),
        it({ heading: '300 wasted steps', icon: '⏳', anchor: 'three hundred more', at: 0.8 }),
      ],
    },
    {
      id: 'demo-journey',
      template: 'journey',
      title: 'What happens on every read',
      subtitle: 'One request, four stops — and only the last one hurts.',
      narration:
        'Follow one read through the machine. The core asks for a value, L1 answers in about a nanosecond if it has it, L2 takes a few more, and only a miss pays the long trip out to main memory.',
      image: '',
      data: '',
      items: [
        it({ heading: 'Core asks', body: 'A load instruction needs a value', icon: '🧠', anchor: 'core asks for a value', at: 0.2 }),
        it({ heading: 'L1 answers', body: '32 KB close by, ~1 ns', icon: '⚡', anchor: 'about a nanosecond', at: 0.45 }),
        it({ heading: 'L2 backs it up', body: '~4 ns, a few times larger', icon: '📦', anchor: 'takes a few more', at: 0.65 }),
        it({ heading: 'Miss goes to RAM', body: 'The long trip: ~100 ns', icon: '🐢', anchor: 'long trip', at: 0.88 }),
      ],
    },
    {
      id: 'demo-chart',
      template: 'chart',
      title: 'The cost of missing',
      subtitle: 'Each level out is roughly an order of magnitude slower.',
      narration:
        'Put the latencies side by side and the shape is obvious. L1 costs about one nanosecond, L2 four, L3 twelve, and main memory a hundred. [pause] Every step outward is close to an order of magnitude.',
      image: '',
      data: 'L1|1\nL2|4\nL3|12\nRAM|100',
      items: [it({ heading: 'Latency', anchor: 'latencies side by side', at: 0.35 })],
    },
    {
      id: 'demo-steps',
      template: 'steps',
      title: 'How a lookup actually resolves',
      subtitle: 'Four decisions, every single time.',
      narration:
        'Inside, a lookup is mechanical. The address is split into a tag and an index, the index selects a set, the tags in that set are compared in parallel, and a match returns the line. No match, and the request goes outward.',
      image: '',
      data: '',
      items: [
        it({ heading: 'Split address', body: 'Into tag, index and offset', icon: '✂️', anchor: 'split into a tag', at: 0.3 }),
        it({ heading: 'Select set', body: 'The index picks one row', icon: '🎯', anchor: 'index selects a set', at: 0.5 }),
        it({ heading: 'Compare tags', body: 'All ways checked at once', icon: '🔍', anchor: 'compared in parallel', at: 0.7 }),
        it({ heading: 'Hit or miss', body: 'Return the line, or go outward', icon: '🚦', anchor: 'match returns the line', at: 0.88 }),
      ],
    },
    {
      id: 'demo-mindmap',
      template: 'mindmap',
      title: 'Why caching works',
      subtitle: 'Programs are predictable in specific ways.',
      narration:
        'A cache would be useless if your next request were random. It works because programs repeat themselves: you want the same value again soon, you want its neighbour next, loops revisit the same code, and the stack stays hot.',
      image: '',
      data: '',
      items: [
        it({ heading: 'Temporal locality', body: 'The same value, again soon', icon: '🔁', anchor: 'same value again', at: 0.35 }),
        it({ heading: 'Spatial locality', body: 'Its neighbour, right after', icon: '🏘️', anchor: 'want its neighbour', at: 0.55 }),
        it({ heading: 'Hot loops', body: 'The same code, over and over', icon: '♾️', anchor: 'loops revisit', at: 0.72 }),
        it({ heading: 'Hot stack', body: 'Frames pushed and popped nearby', icon: '🗂️', anchor: 'stack stays hot', at: 0.88 }),
      ],
    },
    {
      id: 'demo-table',
      template: 'table',
      title: 'The memory hierarchy, in numbers',
      subtitle: 'Each level trades size against speed.',
      narration:
        'Laid out as a table, the trade is plain. L1 is tiny and instant, L2 and L3 grow larger and slower, and main memory is enormous and slow. Every level buys capacity by giving up latency.',
      image: '',
      data: 'Level|Size|Latency|Where\nL1|32 KB|~1 ns|On the core\nL2|512 KB|~4 ns|Beside the core\nL3|32 MB|~12 ns|Shared on die\nRAM|16 GB|~100 ns|Across the board',
      items: [it({ heading: 'Hierarchy', anchor: 'Laid out as a table', at: 0.3 })],
    },
    {
      id: 'demo-gallery',
      template: 'gallery',
      title: 'Where it all physically lives',
      subtitle: 'Three pieces of hardware, three distances.',
      narration:
        'This is the hierarchy in the flesh. The die itself carries L1 and L2 micrometres from the logic. The memory module sits centimetres away across the board. And the solid state drive, further still, is a different world entirely.',
      image: '',
      data: '',
      items: [
        it({ heading: 'The die', body: 'L1 and L2, micrometres away', icon: '🔬', anchor: 'die itself', image: 'CPU silicon die shot photograph', at: 0.35 }),
        it({ heading: 'The module', body: 'DRAM, centimetres across the board', icon: '📏', anchor: 'memory module', image: 'DRAM memory module photograph', at: 0.6 }),
        it({ heading: 'The drive', body: 'Storage, a different world', icon: '💾', anchor: 'solid state drive', image: 'NVMe SSD drive photograph', at: 0.85 }),
      ],
    },
    {
      id: 'demo-stats',
      template: 'stats',
      title: 'Why a tiny cache is enough',
      subtitle: 'The hit rate does all the work.',
      narration:
        'Here is the whole argument in three numbers. The cache holds well under one percent of memory, catches around ninety-five percent of reads, and cuts average access time by roughly twenty times.',
      image: '',
      data: '',
      items: [
        it({ heading: '<1%', body: 'of memory actually cached', icon: '📦', anchor: 'one percent of memory', at: 0.35 }),
        it({ heading: '95%', body: 'of reads never leave the chip', icon: '🎯', anchor: 'ninety-five percent', at: 0.6 }),
        it({ heading: '20×', body: 'faster on average', icon: '🚀', anchor: 'twenty times', at: 0.85 }),
      ],
    },
  ],
}
