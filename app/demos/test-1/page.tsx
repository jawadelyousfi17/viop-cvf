'use client'

import MuralPlayer from '@/components/demos/MuralPlayer'
import { buildTest1 } from '@/components/demos/test1-mural'

/** The panelled night board — after the reference sketch. */
export default function Test1Page() {
  return (
    <MuralPlayer
      cue="docker-hood.cues.json"
      corner="docker · test-1"
      kicker="a look and a way, together · first three scenes"
      title="test-1"
      blurb="The night board. Ideas framed in white panels on deep navy, the subject always in yellow, mint arrows fanning to labels — and big hand-drawn machines doing the talking."
      build={buildTest1}
      scenes={3}
      colorScheme="dark"
      variant="v-navy"
      grid={false}
      wallTheme={{
        tone: { red: 'yellow', green: 'light-green', blue: 'light-blue' },
      }}
      cardTheme={{
        ink: '#e6edf3',
        paper: '#121b12',
        tone: {
          black: '#e8eef7', grey: '#8b98ab', red: '#f2c94c',
          blue: '#6cb6ff', green: '#9fe8b8', orange: '#f2c94c',
        },
        tokens: { com: '#8b98ab', str: '#9fe8b8', num: '#f2c94c', key: '#ff7b72', cmd: '#6cb6ff' },
      }}
    />
  )
}
