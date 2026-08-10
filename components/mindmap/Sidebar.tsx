'use client'

import { useMemo, useState } from 'react'
import { AuthPanel } from './AuthPanel'
import { Logo } from '../ui/Logo'
import { BetaBadge } from '../ui/BetaBadge'
import { IconChevron, IconPlus, IconSearch, IconSparkle, IconTrash } from './icons'

/** One row of the history list. */
export interface SavedMap {
  id: string
  title: string
  topic: string
  source: string
  nodeCount: number
  depth: number
  updatedAt: string
}

/**
 * The rail: what this is, what else there is, and everything you have mapped.
 *
 * Always on screen, including while a map is open. The board used to take over
 * the whole window, which meant leaving your work to reach anything else —
 * history, a new topic, your account. One shell, and the panel beside it holds
 * whatever you are doing.
 *
 * History is grouped by when it was last touched rather than listed flat: a
 * list of forty titles is a wall, and "Today" versus "Earlier" is the only
 * distinction anyone actually scans for.
 *
 * Full height, and the only white surface on this side of the window — the
 * panel is the other one, and the app's background runs between them.
 */
export type Mode = 'map' | 'lesson' | 'math'

/** A lesson in the history list. Same shape as a map, different noun. */
export interface SavedLesson {
  id: string
  title: string
  topic: string
  summary: string
  sceneCount: number
  updatedAt: string
}

export function Sidebar({
  history,
  lessons,
  currentId,
  opening,
  mode,
  onOpen,
  onForget,
  onNew,
  onIdentityChange,
}: {
  history: SavedMap[]
  lessons: SavedLesson[]
  currentId: string | null
  opening: string | null
  mode: Mode
  onOpen: (id: string) => Promise<void>
  onForget: (id: string) => Promise<void>
  onNew: () => void
  onIdentityChange: () => void
}) {
  const [query, setQuery] = useState('')

  // The two sides keep separate lists; the rail shows the one you are in.
  const rows = useMemo<SavedMap[]>(
    () =>
      mode === 'map'
        ? history
        : mode === 'math'
          ? []
          : lessons.map((entry) => ({
            id: entry.id,
            title: entry.title,
            topic: entry.topic,
            source: 'lesson',
            nodeCount: entry.sceneCount,
            depth: 0,
            updatedAt: entry.updatedAt,
          })),
    [mode, history, lessons]
  )

  const groups = useMemo(() => group(rows, query), [rows, query])

  return (
    <aside className="hidden h-dvh w-[288px] shrink-0 flex-col gap-3 border-r border-zinc-200 bg-white p-4 lg:flex">
      {/* The one place the app says what it is. The rail opened straight into
          a search box, which left the workspace unbranded on every screen
          somebody actually spends their time on. */}
      <div className="flex items-center gap-2 px-1 pb-1 pt-1">
        <Logo height={26} />
        <BetaBadge />
      </div>

      <label className="flex h-11 items-center gap-2.5 rounded-xl bg-zinc-100 px-3 text-zinc-500">
        <IconSearch className="size-[18px]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your maps"
          className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-zinc-400"
        />
      </label>

      <nav className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onNew}
          className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] transition ${
            currentId === null
              ? 'bg-zinc-100 text-zinc-900'
              : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
          }`}
        >
          <IconPlus className="size-[17px]" />
          {mode === 'map' ? 'New map' : mode === 'lesson' ? 'New lesson' : 'New problem'}
        </button>
      </nav>

      <div className="-mr-1 flex-1 overflow-y-auto pr-1">
        {groups.length === 0 ? (
          <p className="px-2 py-3 text-[13px] leading-relaxed text-zinc-400">
            {query
              ? 'Nothing by that name.'
              : mode === 'lesson'
                ? 'Lessons you watch are kept here.'
                : mode === 'math'
                  ? 'Worked solutions are not kept yet.'
                  : 'Maps you make are kept here.'}
          </p>
        ) : (
          groups.map((section) => (
            <section key={section.label} className="mb-1">
              <h3 className="flex h-8 items-center gap-1.5 px-2 text-[12px] font-medium text-zinc-400">
                <IconChevron className="size-3.5" />
                {section.label}
              </h3>
              <ul className="flex flex-col gap-1">
                {section.maps.map((entry) => (
                  <li key={entry.id} className="group/row flex items-center">
                    <button
                      type="button"
                      onClick={() => void onOpen(entry.id)}
                      disabled={Boolean(opening)}
                      title={entry.title}
                      className={`flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 text-[13px] transition disabled:opacity-60 ${
                        entry.id === currentId
                          ? 'bg-zinc-100 text-zinc-900'
                          : 'text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      <IconSparkle
                        className={`size-4 shrink-0 ${
                          entry.depth > 3 ? 'text-amber-500' : 'text-sky-400'
                        }`}
                      />
                      <span className="truncate">{entry.title}</span>
                      {opening === entry.id && (
                        <span className="ml-auto shrink-0 text-[11px] text-zinc-400">opening…</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onForget(entry.id)}
                      aria-label={`Delete ${entry.title}`}
                      className="ml-0.5 shrink-0 rounded-md p-1 text-transparent transition group-hover/row:text-zinc-300 hover:!text-zinc-600"
                    >
                      <IconTrash className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <div className="border-t border-zinc-100 pt-3">
        <AuthPanel onChange={onIdentityChange} />
      </div>
    </aside>
  )
}

/** Today, yesterday, this week, before that — and nothing else. */
function group(history: SavedMap[], query: string) {
  const needle = query.trim().toLowerCase()
  const matching = needle
    ? history.filter((entry) => entry.title.toLowerCase().includes(needle))
    : history

  const buckets: { label: string; maps: SavedMap[] }[] = [
    { label: 'Today', maps: [] },
    { label: 'Yesterday', maps: [] },
    { label: 'Previous 7 days', maps: [] },
    { label: 'Older', maps: [] },
  ]

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const day = 24 * 60 * 60 * 1000

  for (const entry of matching) {
    const age = startOfToday.getTime() - new Date(entry.updatedAt).getTime()
    if (age <= 0) buckets[0].maps.push(entry)
    else if (age <= day) buckets[1].maps.push(entry)
    else if (age <= day * 7) buckets[2].maps.push(entry)
    else buckets[3].maps.push(entry)
  }

  return buckets.filter((bucket) => bucket.maps.length)
}
