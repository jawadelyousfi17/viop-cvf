import type { Metadata } from 'next'
import { sectionPage } from '@/lib/section-page'

export const metadata: Metadata = { title: 'Worked solution — nipsol' }

export default async function SolutionPage(ctx: PageProps<'/math-tutor/[id]'>) {
  const { id } = await ctx.params
  return sectionPage('math', id)
}
