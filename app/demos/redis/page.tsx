'use client'

import MuralPlayer from '@/components/demos/MuralPlayer'
import { buildRedisActs } from '@/components/demos/redis-mural'

export default function RedisDemoPage() {
  return (
    <MuralPlayer
      cue="redis.cues.json"
      corner="redis · under the hood"
      kicker="drawn onto one wall · 8 minutes"
      title="Redis will finally make sense"
      blurb="You know it as the thing you bolt on when the database gets slow. This is everything underneath: why RAM changes the rules, what a data structure store actually is, how one thread outruns a thread pool, and the fork trick that lets it remember without ever stopping."
      build={buildRedisActs}
    />
  )
}
