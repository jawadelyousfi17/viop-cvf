'use client'

import dynamic from 'next/dynamic'

// tldraw is browser-only and heavy — keep it out of the server bundle.
const WhiteboardStudio = dynamic(() => import('./whiteboard/WhiteboardStudio'), { ssr: false })

/**
 * One engine, two fixed models: gpt-5.6-terra writes the narration script,
 * gpt-5.6-luna draws the board for it. Nothing left to choose.
 */
export default function Studio() {
  return <WhiteboardStudio engine="whiteboard" />
}
