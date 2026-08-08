import type { Metadata } from 'next'
import Link from 'next/link'
import '@/components/demos/demo.css'

export const metadata: Metadata = {
  title: 'Pick a look',
  description: 'Five styles of the drawn explainer, sampled on the first three scenes of the Docker lesson.',
}

const LOOKS = [
  { href: '/demos/styles/blueprint', title: 'Blueprint', swatch: ['#12385f', '#dcebfc', '#8fd2ff'],
    blurb: 'White and cyan ink on deep blueprint blue, monospace lettering.' },
  { href: '/demos/styles/chalk', title: 'Chalkboard', swatch: ['#253730', '#f2efe3', '#ffd97a'],
    blurb: 'Soft chalk on green slate — yellow for what matters, pink for what bites.' },
  { href: '/demos/styles/atelier', title: 'Atelier', swatch: ['#f3e9d2', '#43301d', '#b3402a'],
    blurb: 'A field journal: sepia serif on warm cream, red kept for one circle.' },
  { href: '/demos/styles/phosphor', title: 'Phosphor', swatch: ['#040a06', '#9dffb0', '#ffe08a'],
    blurb: 'Green phosphor on black glass, amber where it warns.' },
  { href: '/demos/styles/pop', title: 'Pop print', swatch: ['#ffffff', '#14151f', '#e5484d'],
    blurb: 'A riso poster: flat filled shapes, loud primaries, clean sans.' },
]

export default function StylesIndex() {
  return (
    <main className="plate">
      <div className="card" style={{ gap: 30 }}>
        <p className="micro" style={{ letterSpacing: '0.32em' }}>
          five looks · the same three scenes
        </p>
        <h1 style={{ fontSize: 'clamp(36px, 5vw, 76px)' }}>Pick a look</h1>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1150 }}>
          {LOOKS.map((look) => (
            <Link
              key={look.href}
              href={look.href}
              style={{
                display: 'block', width: 340, textAlign: 'left', textDecoration: 'none',
                border: '1.5px solid var(--ink)', padding: '22px 24px', color: 'var(--ink)',
              }}
            >
              <span style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {look.swatch.map((c) => (
                  <span key={c} style={{ width: 26, height: 26, background: c, border: '1px solid rgba(0,0,0,0.25)', display: 'inline-block' }} />
                ))}
              </span>
              <p style={{ margin: '0 0 8px', fontFamily: 'var(--display)', fontSize: 26, lineHeight: 1.05 }}>{look.title}</p>
              <p style={{ margin: 0, fontFamily: 'var(--technical)', fontWeight: 300, fontSize: 12.5, lineHeight: 1.7, color: 'var(--graphite)' }}>
                {look.blurb}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
