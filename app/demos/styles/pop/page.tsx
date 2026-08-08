'use client'

import MuralPlayer from '@/components/demos/MuralPlayer'
import { buildActs } from '@/components/demos/mural'

/** A riso print: flat filled shapes in loud primaries on plain white. */
export default function PopSample() {
  return (
    <MuralPlayer
      cue="docker-hood.cues.json"
      corner="docker · style — pop print"
      kicker="style sample · first three scenes"
      title="Pop print"
      blurb="A risograph poster. Flat filled shapes, loud primaries, clean sans lettering on plain white — a zine explaining the kernel."
      build={buildActs}
      scenes={3}
      variant="v-pop"
      grid={false}
      wallTheme={{
        font: 'sans',
        fill: 'solid',
        tone: { grey: 'light-violet', blue: 'violet' },
      }}
      cardTheme={{
        ink: '#14151f',
        paper: '#fff8dc',
        tone: {
          black: '#14151f', grey: '#8f8bb8', red: '#e5484d',
          blue: '#6e56cf', green: '#2f9e6e', orange: '#f5a623',
        },
        tokens: { com: '#8f8bb8', str: '#2f9e6e', num: '#f5a623', key: '#6e56cf', cmd: '#e5484d' },
      }}
    />
  )
}
