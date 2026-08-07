import type { Metadata } from 'next'
import Link from 'next/link'
import '@/components/demos/demo.css'

export const metadata: Metadata = {
  title: 'Drawn explainers',
  description:
    'Recorded lessons drawn onto a tldraw wall in time with the narration — Docker and Redis, under the hood.',
}

const DEMOS = [
  {
    href: '/demos/docker',
    kicker: '17 stations · 9 minutes',
    title: 'What Docker actually does',
    blurb: 'Namespaces, cgroups, overlayfs, and the three programs that hand the job on before anything starts.',
  },
  {
    href: '/demos/redis',
    kicker: '19 stations · 8 minutes',
    title: 'Redis will finally make sense',
    blurb: 'Why RAM changes the rules, how one thread beats a thread pool, and the fork trick behind persistence.',
  },
]

export default function DemosIndex() {
  return (
    <main className="plate">
      <div className="card" style={{ gap: 34 }}>
        <p className="micro" style={{ letterSpacing: '0.32em' }}>
          drawn explainers · pick one
        </p>
        <h1 style={{ fontSize: 'clamp(40px, 6vw, 88px)' }}>Under the hood</h1>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
          {DEMOS.map((demo) => (
            <Link
              key={demo.href}
              href={demo.href}
              style={{
                display: 'block', width: 380, textAlign: 'left', textDecoration: 'none',
                border: '1.5px solid var(--ink)', padding: '26px 28px', color: 'var(--ink)',
                background: 'transparent',
              }}
            >
              <p className="micro" style={{ margin: 0 }}>{demo.kicker}</p>
              <p style={{ margin: '10px 0 12px', fontFamily: 'var(--display)', fontSize: 30, lineHeight: 1.05 }}>
                {demo.title}
              </p>
              <p style={{ margin: 0, fontFamily: 'var(--technical)', fontWeight: 300, fontSize: 13, lineHeight: 1.8, color: 'var(--graphite)' }}>
                {demo.blurb}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
