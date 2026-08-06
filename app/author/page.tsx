'use client'

import dynamic from 'next/dynamic'

/**
 * Client-only. The tool is entirely local state — a draft in localStorage, a
 * tldraw canvas, and audio — so there is nothing for the server to render, and
 * `ssr: false` needs a client boundary to live in.
 */
const AuthorStudio = dynamic(() => import('@/components/author/AuthorStudio'), {
  ssr: false,
  loading: () => (
    <main className="flex h-dvh items-center justify-center bg-zinc-100 text-sm text-zinc-500">
      Loading the board…
    </main>
  ),
})

export default function AuthorPage() {
  return <AuthorStudio />
}
