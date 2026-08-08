'use client'

import MuralPlayer from '@/components/demos/MuralPlayer'
import { buildActs } from '@/components/demos/mural'

/** A CRT terminal: green phosphor burning on black glass. */
export default function PhosphorSample() {
  return (
    <MuralPlayer
      cue="docker-hood.cues.json"
      corner="docker · style — phosphor"
      kicker="style sample · first three scenes"
      title="Phosphor"
      blurb="A CRT in a dark server room. Everything is green phosphor on black glass — brighter where it matters, amber where it warns."
      build={buildActs}
      scenes={3}
      colorScheme="dark"
      variant="v-phosphor"
      grid={false}
      wallTheme={{
        font: 'mono',
        dash: 'solid',
        tone: { black: 'light-green', grey: 'green', red: 'yellow', blue: 'light-green', green: 'light-green', orange: 'yellow' },
      }}
      cardTheme={{
        ink: '#9dffb0',
        paper: '#03130a',
        tone: {
          black: '#9dffb0', grey: '#3f9a58', red: '#ffe08a',
          blue: '#7de6d2', green: '#9dffb0', orange: '#ffe08a',
        },
        tokens: { com: '#3f9a58', str: '#7de6d2', num: '#ffe08a', key: '#d2ff7d', cmd: '#9dffb0' },
      }}
    />
  )
}
