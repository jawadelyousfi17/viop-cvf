'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { DEFAULT_ENGINE, isEngine, type Engine } from '@/lib/engines'
import { EngineChooser } from './EngineChooser'
import { ProviderChooser } from './ProviderChooser'
import { DEFAULT_PROVIDER, isProvider, type Provider } from '@/lib/providers'

// tldraw is browser-only and heavy — keep it out of the server bundle and off
// the critical path when the slides engine is selected.
const WhiteboardStudio = dynamic(() => import('./whiteboard/WhiteboardStudio'), { ssr: false })
const CanvasStudio = dynamic(() => import('./canvas/CanvasStudio'), { ssr: false })
const TemplateStudio = dynamic(() => import('./template/TemplateStudio'), { ssr: false })
const ManimStudio = dynamic(() => import('./manim/ManimStudio'), { ssr: false })

/**
 * Top-level shell. Owns which engine is in use and renders that engine's
 * player; each one keeps its own lesson state, so switching engines starts
 * fresh rather than trying to translate a lesson between two languages.
 */
/**
 * `?engine=whiteboard` makes a choice linkable, which is what makes the two
 * engines practical to compare on the same topic. Read as the initial state
 * rather than in an effect, so there is no flash of the wrong engine.
 */
function initialEngine(): Engine {
  if (typeof window === 'undefined') return DEFAULT_ENGINE
  const requested = new URLSearchParams(window.location.search).get('engine')
  return isEngine(requested) ? requested : DEFAULT_ENGINE
}

function initialProvider(): Provider {
  if (typeof window === 'undefined') return DEFAULT_PROVIDER
  const requested = new URLSearchParams(window.location.search).get('provider')
  return isProvider(requested) ? requested : DEFAULT_PROVIDER
}

export default function Studio() {
  const [engine, setEngine] = useState<Engine>(initialEngine)
  const [provider, setProvider] = useState<Provider>(initialProvider)

  const chooser = (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
      <EngineChooser value={engine} onChange={setEngine} />
      <ProviderChooser value={provider} onChange={setProvider} />
    </div>
  )

  if (engine === 'whiteboard') {
    return <WhiteboardStudio key="whiteboard" engine={engine} provider={provider} chooser={chooser} />
  }
  if (engine === 'canvas') {
    return <CanvasStudio key="canvas" engine={engine} provider={provider} chooser={chooser} />
  }
  if (engine === 'manim') {
    return <ManimStudio key="manim" engine={engine} provider={provider} chooser={chooser} />
  }
  return <TemplateStudio key="slides" engine={engine} provider={provider} chooser={chooser} />
}
