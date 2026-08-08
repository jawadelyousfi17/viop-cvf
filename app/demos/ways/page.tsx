import type { Metadata } from 'next'
import Link from 'next/link'
import { WAY_LIST } from '@/components/demos/ways-list'
import '@/components/demos/demo.css'

export const metadata: Metadata = {
  title: 'Ten ways to explain',
  description: 'The same three scenes of the Docker lesson, explained ten different ways.',
}

export default function WaysIndex() {
  return (
    <main className="plate">
      <div className="card" style={{ gap: 28 }}>
        <p className="micro" style={{ letterSpacing: '0.32em' }}>
          one narration · ten teachers
        </p>
        <h1 style={{ fontSize: 'clamp(34px, 4.6vw, 70px)' }}>Ten ways to explain</h1>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1300 }}>
          {WAY_LIST.map((way, i) => (
            <Link
              key={way.slug}
              href={`/demos/ways/${way.slug}`}
              style={{
                display: 'block', width: 380, textAlign: 'left', textDecoration: 'none',
                border: '1.5px solid var(--ink)', padding: '18px 22px', color: 'var(--ink)',
              }}
            >
              <p className="micro" style={{ margin: 0 }}>{String(i + 1).padStart(2, '0')}</p>
              <p style={{ margin: '6px 0 8px', fontFamily: 'var(--display)', fontSize: 24, lineHeight: 1.05 }}>
                {way.title}
              </p>
              <p style={{ margin: 0, fontFamily: 'var(--technical)', fontWeight: 300, fontSize: 12, lineHeight: 1.65, color: 'var(--graphite)' }}>
                {way.blurb}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
