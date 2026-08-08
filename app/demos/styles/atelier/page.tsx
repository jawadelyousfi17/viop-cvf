'use client'

import MuralPlayer from '@/components/demos/MuralPlayer'
import { buildActs } from '@/components/demos/mural'

/** A naturalist's field journal: sepia serif on warm cream. */
export default function AtelierSample() {
  return (
    <MuralPlayer
      cue="docker-hood.cues.json"
      corner="docker · style — atelier"
      kicker="style sample · first three scenes"
      title="Atelier"
      blurb="A naturalist's field journal. Sepia ink and serif lettering on warm cream, red kept for the one thing worth circling."
      build={buildActs}
      scenes={3}
      variant="v-atelier"
      grid={false}
      wallTheme={{
        font: 'serif',
        tone: { blue: 'violet', green: 'orange' },
      }}
      cardTheme={{
        ink: '#43301d',
        paper: '#fbf2dc',
        tone: {
          black: '#43301d', grey: '#a8916f', red: '#b3402a',
          blue: '#6d4fa3', green: '#b07d1a', orange: '#b07d1a',
        },
        tokens: { com: '#a8916f', str: '#7c6a2a', num: '#b3402a', key: '#6d4fa3', cmd: '#43301d' },
      }}
    />
  )
}
