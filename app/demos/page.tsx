import type { Metadata } from 'next'
import TldrawDemo from '@/components/demos/TldrawDemo'

/**
 * The tldraw mural version. The earlier SVG-plate renderer is kept alongside
 * in components/demos/DockerDemo.tsx — same recording, same cue sheet, a
 * different answer to how the drawing should live.
 */
export const metadata: Metadata = {
  title: 'What Docker actually does — a drawn explainer',
  description:
    'Seventeen plates drawn in time with a nine-minute narration: namespaces, control groups, overlay file systems, and the three programs that hand the job on.',
}

export default function DemosPage() {
  return <TldrawDemo />
}
