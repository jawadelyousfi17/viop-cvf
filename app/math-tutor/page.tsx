import type { Metadata } from 'next'
import { sectionPage } from '@/lib/section-page'

export const metadata: Metadata = {
  title: 'Math tutor — nipsol',
  description: 'A problem worked through a step at a time, with the reasoning beside the working.',
}

export default async function MathPage() {
  return sectionPage('math')
}
