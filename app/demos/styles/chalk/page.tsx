'use client'

import MuralPlayer from '@/components/demos/MuralPlayer'
import { buildActs } from '@/components/demos/mural'

/** A lecture hall chalkboard: soft chalk on deep green slate. */
export default function ChalkSample() {
  return (
    <MuralPlayer
      cue="docker-hood.cues.json"
      corner="docker · style — chalkboard"
      kicker="style sample · first three scenes"
      title="Chalkboard"
      blurb="The lecture hall. Soft white chalk on green slate, yellow for what matters, pink for what bites — and dust where the pen pressed."
      build={buildActs}
      scenes={3}
      colorScheme="dark"
      variant="v-chalk"
      grid={false}
      wallTheme={{
        tone: { red: 'yellow', orange: 'light-red', blue: 'light-blue', green: 'light-green' },
      }}
      cardTheme={{
        ink: '#f2efe3',
        paper: '#1d2b25',
        tone: {
          black: '#f2efe3', grey: '#9aa392', red: '#ffd97a',
          blue: '#a8d8e8', green: '#b5e3b0', orange: '#f2a1b4',
        },
        tokens: { com: '#8f9584', str: '#b5e3b0', num: '#ffd97a', key: '#f2a1b4', cmd: '#a8d8e8' },
      }}
    />
  )
}
