import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { parseCourse } from '@/lib/course'
import { CourseRoom } from '@/components/course/CourseRoom'

/** A name, never a path — the same guard the route handler applies. */
const SLUG = /^[a-z0-9][a-z0-9-]{0,60}$/

async function read(slug: string) {
  if (!SLUG.test(slug)) return null
  try {
    const source = await readFile(join(process.cwd(), 'courses', `${slug}.md`), 'utf8')
    return parseCourse(source, slug)
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: PageProps<'/course/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const course = await read(slug)
  if (!course) return { title: 'Lesson not found' }
  return { title: `${course.title} — viop`, description: course.takeaway }
}

export default async function CoursePage({ params }: PageProps<'/course/[slug]'>) {
  const { slug } = await params
  // Checked here rather than in the client, so a bad link is a 404 and not a
  // spinner that never resolves.
  if (!(await read(slug))) notFound()
  return <CourseRoom slug={slug} />
}
