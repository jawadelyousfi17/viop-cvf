'use client'

import MuralPlayer from '@/components/demos/MuralPlayer'
import { buildActs } from '@/components/demos/mural'

export default function DockerDemoPage() {
  return (
    <MuralPlayer
      cue="docker-hood.cues.json"
      corner="docker · under the hood"
      kicker="drawn onto one wall · 9 minutes"
      title="What Docker actually does"
      blurb="Seventeen stations on a single canvas, drawn in time with the narration. The camera travels as the story does — and when it ends, it pulls back to show you the whole wall. Pause any time and the drawings are real: pan, zoom, pick them up."
      build={buildActs}
    />
  )
}
