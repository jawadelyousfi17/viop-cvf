import { redirect } from 'next/navigation'
import MindmapStudio from '@/components/mindmap/MindmapStudio'
import { authConfigured, currentUser } from '@/lib/supabase/server'
import { sectionFor, type WorkKind } from '@/lib/routes'

/**
 * One workspace, six addresses.
 *
 * `/mindmap`, `/lessons` and `/math-tutor` are the three sides, and each takes
 * an id to open something on it. They are not different screens — the same
 * component renders all of them — so this exists to keep the wall and the
 * redirect in one place rather than copied into six files that then drift.
 */
export async function sectionPage(kind: WorkKind, id?: string) {
  const next = id ? `${sectionFor(kind)}/${id}` : sectionFor(kind)
  if (authConfigured() && !(await currentUser())) redirect(`/login?next=${next}`)

  return <MindmapStudio section={kind} open={id ? { kind, id } : null} />
}
