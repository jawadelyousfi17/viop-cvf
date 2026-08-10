import type { Metadata } from 'next'
import { sectionPage } from '@/lib/section-page'

export const metadata: Metadata = {
  title: 'Lessons — nipsol',
  description: 'A topic taught at the whiteboard, drawn and narrated as it goes.',
}

export default async function LessonsPage() {
  return sectionPage('lesson')
}
