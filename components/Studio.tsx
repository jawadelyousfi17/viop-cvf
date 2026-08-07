'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { DEFAULT_ENGINE, isEngine, type Engine } from '@/lib/engines'
import { EngineChooser } from './EngineChooser'
import { ProviderChooser } from './ProviderChooser'
import {
  DEFAULT_PROVIDER,
  isKnownModel,
  isProvider,
  MODEL_VARIANTS,
  type Provider,
} from '@/lib/providers'
import { ModelChooser } from './ModelChooser'

// tldraw is browser-only and heavy — keep it out of the server bundle and off
// the critical path when the slides engine is selected.
const WhiteboardStudio = dynamic(() => import('./whiteboard/WhiteboardStudio'), { ssr: false })
const CanvasStudio = dynamic(() => import('./canvas/CanvasStudio'), { ssr: false })
const TemplateStudio = dynamic(() => import('./template/TemplateStudio'), { ssr: false })
const ManimStudio = dynamic(() => import('./manim/ManimStudio'), { ssr: false })
const ITStudio = dynamic(() => import('./it/ITStudio'), { ssr: false })

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
  const params = new URLSearchParams(window.location.search)

  const requested = params.get('engine')
  if (isEngine(requested)) return requested

  // `?demo=1` means the whiteboard demo. Three engines each answer that flag
  // with a demo of their own, and falling through to the default meant the one
  // written to be shown to people was the one you couldn't get to without
  // knowing to ask for it by name.
  if (params.has('demo')) return 'whiteboard'

  return DEFAULT_ENGINE
}

/** `?model=` makes a comparison linkable, the same way `?engine=` does. */
function initialModel(provider: Provider): string {
  const fallback = MODEL_VARIANTS[provider][0]
  if (typeof window === 'undefined') return fallback
  const requested = new URLSearchParams(window.location.search).get('model')
  return isKnownModel(provider, requested) ? requested : fallback
}

function initialProvider(): Provider {
  if (typeof window === 'undefined') return DEFAULT_PROVIDER
  const requested = new URLSearchParams(window.location.search).get('provider')
  return isProvider(requested) ? requested : DEFAULT_PROVIDER
}

export default function Studio() {
  const [engine, setEngine] = useState<Engine>(initialEngine)
  const [provider, setProvider] = useState<Provider>(initialProvider)
  const [model, setModel] = useState<string>(() => initialModel(initialProvider()))

  // Each provider has its own variants, so switching provider has to move the
  // model with it rather than leave a name the new one has never heard of.
  function chooseProvider(next: Provider) {
    setProvider(next)
    setModel((current) => (isKnownModel(next, current) ? current : MODEL_VARIANTS[next][0]))
  }

  const chooser = (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
      <EngineChooser value={engine} onChange={setEngine} />
      <ProviderChooser value={provider} onChange={chooseProvider} />
      <ModelChooser provider={provider} value={model} onChange={setModel} />
    </div>
  )

  if (engine === 'whiteboard') {
    return <WhiteboardStudio key="whiteboard" engine={engine} provider={provider} model={model} chooser={chooser} />
  }
  if (engine === 'canvas') {
    return <CanvasStudio key="canvas" engine={engine} provider={provider} model={model} chooser={chooser} />
  }
  if (engine === 'manim') {
    return <ManimStudio key="manim" engine={engine} provider={provider} model={model} chooser={chooser} />
  }
  if (engine === 'it') {
    return <ITStudio key="it" engine={engine} provider={provider} model={model} chooser={chooser} />
  }
  return <TemplateStudio key="slides" engine={engine} provider={provider} model={model} chooser={chooser} />
}
