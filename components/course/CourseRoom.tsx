'use client'

import dynamic from 'next/dynamic'

/**
 * The client boundary `ssr: false` needs to live in.
 *
 * The page itself stays a server component so it can still export metadata —
 * a lesson is a page someone will link to, and a link with no title is a link
 * nobody clicks. Everything below here is a clock, an audio element and a
 * canvas, none of which the server can usefully pre-render.
 */
const CourseStudio = dynamic(() => import('./CourseStudio'), {
  ssr: false,
  loading: () => <main className="course-error">Opening the lesson…</main>,
})

export function CourseRoom({ slug }: { slug: string }) {
  return <CourseStudio slug={slug} />
}
