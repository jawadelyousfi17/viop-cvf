import type { Metadata } from 'next'
import DockerDemo from '@/components/demos/DockerDemo'

/**
 * Imported directly rather than behind `ssr: false`.
 *
 * The demo touches nothing browser-only until its effects run, so the title
 * card renders on the server — which is the whole of the first paint, and the
 * only part anyone waits for. Keeping the page a server component is what lets
 * it carry its own metadata.
 */
export const metadata: Metadata = {
  title: 'What Docker actually does — a drawn explainer',
  description:
    'Seventeen plates drawn in time with a nine-minute narration: namespaces, control groups, overlay file systems, and the three programs that hand the job on.',
}

export default function DemosPage() {
  return <DockerDemo />
}
