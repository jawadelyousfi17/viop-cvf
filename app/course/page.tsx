import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import Link from 'next/link'
import type { Metadata } from 'next'
import { parseCourse } from '@/lib/course'

export const metadata: Metadata = {
  title: 'Courses — viop',
  description: 'Written lessons you work through, with the code in front of you.',
}

/**
 * What is on the shelf.
 *
 * Read off disk rather than through the API route: this is a server component
 * already inside the same process, and a page fetching its own server is a
 * round trip bought with nothing.
 */
async function shelf() {
  let files: string[]
  try {
    files = await readdir(join(process.cwd(), 'courses'))
  } catch {
    return []
  }

  const found = await Promise.all(
    files
      .filter((file) => file.endsWith('.md'))
      .map(async (file) => {
        const slug = file.replace(/\.md$/, '')
        const source = await readFile(join(process.cwd(), 'courses', file), 'utf8')
        const course = parseCourse(source, slug)
        const beats = course.steps.reduce((total, step) => total + step.beats.length, 0)
        const words = course.steps.reduce(
          (total, step) => total + step.narration.split(/\s+/).filter(Boolean).length,
          0
        )
        return {
          slug,
          title: course.title || slug,
          takeaway: course.takeaway,
          steps: course.steps.length,
          beats,
          // Speaking pace, plus a little for the exercises. Honest enough to
          // set an expectation, which is all a shelf entry has to do.
          minutes: Math.max(1, Math.round(words / 2.6 / 60 + course.steps.length * 0.2)),
        }
      })
  )

  return found.sort((a, b) => a.title.localeCompare(b.title))
}

export default async function CoursesPage() {
  const courses = await shelf()

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
        Courses
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Written lessons rather than generated ones — the teacher talks, writes in the
        editor, and hands you the keyboard. The board on the right is yours.
      </p>

      {courses.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">
          Nothing in <code className="font-mono text-xs">courses/</code> yet.
        </p>
      ) : (
        <ul className="mt-10 flex flex-col gap-3">
          {courses.map((course) => (
            <li key={course.slug}>
              <Link
                href={`/course/${course.slug}`}
                className="block rounded-xl border border-black/10 bg-white p-5 transition hover:border-black/25"
              >
                <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
                  {course.title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                  {course.takeaway}
                </p>
                <p className="mt-3 font-mono text-xs text-zinc-400">
                  {course.steps} steps · {course.beats} beats · about {course.minutes} min
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
