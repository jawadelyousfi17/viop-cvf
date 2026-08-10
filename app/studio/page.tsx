import { redirect } from 'next/navigation'

/**
 * The lesson player used to be its own screen. It now lives inside the
 * workspace, next to the mindmaps, so this address only exists to carry old
 * links over to it.
 */
export default function StudioPage() {
  redirect('/mindmap')
}
