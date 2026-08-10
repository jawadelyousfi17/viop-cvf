import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import MindmapStudio from '@/components/mindmap/MindmapStudio'
import { authConfigured, currentUser } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Mindmap — nipsol',
  description: 'A topic drawn as a mindmap on the whiteboard. No voice, no playback.',
}

/**
 * The app, behind the wall.
 *
 * Checked on the server rather than in the page: a client-side check renders
 * the app first and takes it away a moment later, which both flashes the thing
 * you are not allowed to see and leaves the API as the only real gate. Here,
 * a signed-out visitor never receives the page at all.
 *
 * A deployment with no auth configured is not walled — there would be no way
 * through it, and the app would simply be dead.
 *
 * No `dynamic(ssr: false)` wrapper, unlike the lesson player: that exists to
 * keep tldraw out of the server bundle, and the board here is our own SVG
 * engine, which renders on the server as happily as in the browser.
 */
export default async function MindmapPage() {
  if (authConfigured() && !(await currentUser())) redirect('/login?next=/mindmap')

  return <MindmapStudio />
}
