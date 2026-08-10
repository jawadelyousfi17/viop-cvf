import type { Metadata } from 'next'
import { sectionPage } from '@/lib/section-page'

export const metadata: Metadata = { title: 'Mindmap — nipsol' }

export default async function MapPage(ctx: PageProps<'/mindmap/[id]'>) {
  const { id } = await ctx.params
  return sectionPage('map', id)
}
