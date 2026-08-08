'use client'

import MuralPlayer from '@/components/demos/MuralPlayer'
import { buildActs } from '@/components/demos/mural'

/** Midnight drafting table: pale ink and cyan on deep blueprint blue. */
export default function BlueprintSample() {
  return (
    <MuralPlayer
      cue="docker-hood.cues.json"
      corner="docker · style — blueprint"
      kicker="style sample · first three scenes"
      title="Blueprint"
      blurb="An engineer's night shift. White and cyan ink on deep blue paper, monospace lettering, the grid of a drawing office."
      build={buildActs}
      scenes={3}
      colorScheme="dark"
      variant="v-blueprint"
      wallTheme={{
        font: 'mono',
        tone: { red: 'light-blue', orange: 'yellow', blue: 'light-blue', green: 'light-green' },
      }}
      cardTheme={{
        ink: '#dcebfc',
        paper: '#0d2b4c',
        tone: {
          black: '#dcebfc', grey: '#8aa7c6', red: '#8fd2ff',
          blue: '#8fd2ff', green: '#a9e8b8', orange: '#ffe08a',
        },
        tokens: { com: '#7f9bb8', str: '#a9e8b8', num: '#ffe08a', key: '#cdbcff', cmd: '#8fd2ff' },
      }}
    />
  )
}
