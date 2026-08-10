import type { Metadata } from 'next'
import { sectionPage } from '@/lib/section-page'

export const metadata: Metadata = {
  title: 'Mindmap — nipsol',
  description: 'A topic drawn as a mindmap on the whiteboard. No voice, no playback.',
}

/**
 * The maps, behind the wall.
 *
 * The wall is checked on the server rather than in the page: a client-side
 * check renders the app first and takes it away a moment later, which both
 * flashes the thing you are not allowed to see and leaves the API as the only
 * real gate. See lib/section-page.tsx, which the other two sides share.
 */
export default async function MindmapPage() {
  return sectionPage('map')
}
