import type { TemplateLesson } from './template-lesson'

/**
 * A hand-written lesson in exactly the shape the model produces — one scene
 * per template. Loaded at `/?demo=1` so the renderer, reveal timing and scene
 * transitions can be exercised without any API keys.
 */
export const DEMO_LESSON: TemplateLesson = {
  title: 'Why your CPU has a cache',
  summary: 'Memory is slow, so the CPU keeps a small, fast copy of what it just touched.',
  scenes: [
    {
      id: 'demo-journey',
      template: 'journey',
      title: 'What happens on every read',
      subtitle: 'One request, four stops — and only the slow one hurts.',
      narration:
        'Follow one read through the machine. The core asks for a value, the L1 cache answers in about a nanosecond if it has it, L2 takes a few more, and only a miss pays the long trip out to main memory — roughly a hundred nanoseconds away.',
      image: '',
      items: [
        { heading: 'Core asks', body: 'A load instruction needs a value', icon: '🧠', anchor: 'core asks for a value', at: 0.15 },
        { heading: 'L1 answers', body: '32 KB close by, ~1 ns', icon: '⚡', anchor: 'about a nanosecond', at: 0.4 },
        { heading: 'L2 backs it up', body: '~4 ns, a few times larger', icon: '📦', anchor: 'takes a few more', at: 0.6 },
        { heading: 'Miss goes to RAM', body: 'The long trip: ~100 ns', icon: '🐢', anchor: 'hundred nanoseconds', at: 0.85 },
      ],
    },
    {
      id: 'demo-pillars',
      template: 'pillars',
      title: 'Why caching works at all',
      subtitle: 'Programs are predictable in two specific ways.',
      narration:
        'A cache would be useless if your next request were random. It works because programs repeat themselves. [pause] Temporal locality means you will want the same value again soon. Spatial locality means you will want its neighbour next. Hit rate is just how often those bets pay off.',
      image: '',
      items: [
        { heading: 'Temporal locality', body: 'The same value, again soon', icon: '🔁', anchor: 'same value again', at: 0.35 },
        { heading: 'Spatial locality', body: 'The neighbour, right after', icon: '🏘️', anchor: 'want its neighbour', at: 0.6 },
        { heading: 'Hit rate', body: 'How often the bet pays off', icon: '🎯', anchor: 'bets pay off', at: 0.85 },
      ],
    },
    {
      id: 'demo-spotlight',
      template: 'spotlight',
      title: 'The hardware itself',
      subtitle: 'Where those hundred nanoseconds physically go.',
      narration:
        'This is main memory in the flesh — a DRAM module a few centimetres from the socket. The distance is the delay: the signal crosses the board, the module finds the row, and the answer travels back. The cache exists so you rarely make this trip.',
      image: 'DRAM memory module photograph',
      items: [
        { heading: 'Centimetres away', body: 'Signal crosses the board and back', icon: '📏', anchor: 'few centimetres', at: 0.3 },
        { heading: 'Row lookup', body: 'The module finds and opens the row', icon: '🗄️', anchor: 'finds the row', at: 0.6 },
        { heading: 'Rarely visited', body: 'The cache absorbs ~95% of reads', icon: '🛡️', anchor: 'rarely make this trip', at: 0.85 },
      ],
    },
  ],
}
