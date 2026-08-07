'use client'

import MuralPlayer from '@/components/demos/MuralPlayer'
import { buildActs } from '@/components/demos/mural'

const TITLES = [
  'Behind the command', 'A whole computer, simulated', 'Just a process',
  'Everyone can see everyone', 'One process, two realities', 'And the rest of them',
  'Seeing is not consuming', 'A number in a file', 'It still needs a root',
  'Swap the root entirely', 'A stack of layers', 'Frozen, plus one thin layer',
  'A cable to a switch', 'Opening one door', 'Nobody who starts it',
  'Built, then abandoned', 'Nothing but a process',
]

export default function DockerDemoPage() {
  return (
    <MuralPlayer
      cue="docker-hood.cues.json"
      corner="docker · under the hood"
      kicker="drawn onto one wall · 9 minutes"
      title="What Docker actually does"
      blurb="Seventeen stations on a single canvas, drawn in time with the narration. The camera travels as the story does — and when it ends, it pulls back to show you the whole wall. Pause any time and the drawings are real: pan, zoom, pick them up."
      build={buildActs}
      titles={TITLES}
    />
  )
}
