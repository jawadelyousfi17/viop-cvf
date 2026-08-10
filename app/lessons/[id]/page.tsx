import type { Metadata } from 'next'
import { sectionPage } from '@/lib/section-page'

export const metadata: Metadata = { title: 'Lesson — nipsol' }

export default async function LessonPage(ctx: PageProps<'/lessons/[id]'>) {
  const { id } = await ctx.params
  return sectionPage('lesson', id)
}
