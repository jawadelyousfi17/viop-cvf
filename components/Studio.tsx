'use client'

import dynamic from 'next/dynamic'

// tldraw is browser-only and heavy — keep it out of the server bundle.
const WhiteboardStudio = dynamic(() => import('./whiteboard/WhiteboardStudio'), { ssr: false })

/**
 * One engine, one fixed model: gpt-5.6-terra writes the narration script and
 * then draws the board for it, in two separate calls under two separate
 * prompts. Nothing left to choose.
 */
export default function Studio() {
  return <WhiteboardStudio engine="whiteboard" />
}
