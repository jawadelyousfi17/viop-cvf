'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import MuralPlayer from '@/components/demos/MuralPlayer'
import { WAYS } from '@/components/demos/ways'

export default function WayPage() {
  const { way } = useParams<{ way: string }>()
  const def = WAYS.find((w) => w.slug === way)
  if (!def) {
    return (
      <main className="plate">
        <div className="card">
          <h1>No such way</h1>
          <Link href="/demos/ways" style={{ color: 'var(--ink)' }}>back to the ten</Link>
        </div>
      </main>
    )
  }
  return (
    <MuralPlayer
      cue="docker-hood.cues.json"
      corner={`docker · way — ${def.title.toLowerCase()}`}
      kicker="a way of explaining · first three scenes"
      title={def.title}
      blurb={def.blurb}
      build={def.build}
      scenes={3}
    />
  )
}
