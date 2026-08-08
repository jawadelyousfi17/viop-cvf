/**
 * The ten ways, as data — importable from server components.
 * The client-only build functions live in ways.ts, keyed by these slugs.
 */
export interface WayMeta {
  slug: string
  title: string
  blurb: string
}

export const WAY_LIST: WayMeta[] = [
  { slug: 'metaphor', title: 'The shipping crate',
    blurb: 'Everything is a household metaphor: crates, houses, tents. Not one technical drawing — the pictures argue by analogy.' },
  { slug: 'architect', title: 'Boxes and arrows',
    blurb: 'A systems textbook. Strict labelled boxes, layer stacks, ruled arrows — the two architectures drawn side by side.' },
  { slug: 'terminal', title: 'Prove it in the shell',
    blurb: 'No pictures at all. Every claim is demonstrated as a terminal session you could type yourself.' },
  { slug: 'versus', title: 'The scoreboard',
    blurb: 'One comparison table that fills in for the whole three scenes — VM versus container, row by row, verdict at the end.' },
  { slug: 'one-picture', title: 'One drawing, annotated',
    blurb: 'A single picture of your machine that never leaves the screen — the narration just keeps annotating it.' },
  { slug: 'comic', title: 'The comic strip',
    blurb: 'Panels and faces. Your app is a character, the VM is its heavyweight cousin, and the story has an ending.' },
  { slug: 'recipe', title: 'Recipes and bills',
    blurb: 'Numbered steps with checkmarks — and each recipe ends with an itemised bill. The VM’s bill is the argument.' },
  { slug: 'socratic', title: 'Questions first',
    blurb: 'Socratic method: every beat poses a question, answers it, and sharpens the next one — ending on the real question.' },
  { slug: 'race', title: 'Two lanes, one clock',
    blurb: 'Everything happens on timelines. The VM lane crawls through boot ticks; the container lane is over in one tick.' },
  { slug: 'poster', title: 'Five words at a time',
    blurb: 'Typographic minimalism — one huge phrase per beat, a fine-print line under it, nothing else on the paper.' },
]
