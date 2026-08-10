import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import MindmapStudio from '@/components/mindmap/MindmapStudio'
import { authConfigured, currentUser } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Lesson — nipsol',
}

/**
 * One lesson, at its own address.
 *
 * The same workspace as /mindmap, told what to open. It is not a different
 * screen and does not fetch the map here: the studio already knows how to
 * open one by id, and doing it there keeps one path into the board rather
 * than two that can disagree.
 */
export default async function LessonPage(ctx: PageProps<'/lesson/[id]'>) {
  const { id } = await ctx.params
  if (authConfigured() && !(await currentUser())) redirect(`/login?next=/lesson/${id}`)

  return <MindmapStudio open={{ kind: 'lesson', id }} />
}
