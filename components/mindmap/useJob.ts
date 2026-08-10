'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Work that survives the page.
 *
 * Asking for a map used to be one long fetch: the answer existed only inside
 * that connection, so a reload thirty seconds in threw away a model call that
 * had already been paid for and was nearly finished. Now the request only
 * starts a job and the client polls for it — which means closing the tab costs
 * the view and not the work, and coming back picks the job up mid-flight.
 *
 * Polling rather than a socket on purpose: the whole conversation is "is it
 * done yet", the answer arrives within a minute, and a socket would be a
 * connection to keep alive, reconnect, and reason about on a server that has
 * no other reason to hold one open.
 */

/** One finished worked solution, as the rail lists it. */
export interface Solved {
  id: string
  title: string
  updatedAt: string
  demo?: boolean
}

export interface Job {
  id: string
  kind: 'map' | 'expand' | 'math' | 'lesson'
  status: 'running' | 'done' | 'failed'
  input: unknown
  result: unknown
  error: string | null
}

/** Fast enough to feel immediate, slow enough not to hammer the database. */
const EVERY = 1200

export function useJobs(onDone: (job: Job) => void) {
  const [running, setRunning] = useState<Job[]>([])
  /** Worked solutions already finished — history, not the live feed. */
  const [solved, setSolved] = useState<Solved[]>([])
  /** The callback, where the poll loop can reach the latest one. */
  const handler = useRef(onDone)
  useEffect(() => {
    handler.current = onDone
  })

  /** Jobs already handed over, so a slow poll cannot deliver one twice. */
  const seen = useRef(new Set<string>())

  const take = useCallback((jobs: Job[]) => {
    const live: Job[] = []

    for (const job of jobs) {
      if (job.status === 'running') {
        live.push(job)
        continue
      }
      if (seen.current.has(job.id)) continue
      seen.current.add(job.id)
      handler.current(job)
    }

    setRunning(live)
    return live.length > 0
  }, [])

  /**
   * On arrival, ask what was already going on.
   *
   * This is the half that makes a reload survivable: the job was started by a
   * page that no longer exists, and this is how the new one adopts it.
   */
  useEffect(() => {
    let cancelled = false

    const sweep = async () => {
      try {
        const response = await fetch('/api/jobs')
        const body = (await response.json()) as { jobs?: Job[]; solved?: Solved[] }
        if (cancelled) return
        take(body.jobs ?? [])
        // History rides along with the live feed rather than on a poll of its
        // own: the answer changes at exactly the moment a job finishes, which
        // is the moment this request already tells us about.
        setSolved(body.solved ?? [])
      } catch {
        // Offline, or signed out. The next tick tries again.
      }
    }

    void sweep()
    const timer = setInterval(sweep, EVERY)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [take])

  /** Starts a job and returns its id, or null if it could not be started. */
  const start = useCallback(async (kind: Job['kind'], input: unknown) => {
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, input }),
      })
      const body = (await response.json()) as { id?: string; error?: string }
      if (!response.ok || !body.id) throw new Error(body.error ?? 'Could not start that.')

      setRunning((current) => [
        ...current,
        { id: body.id!, kind, status: 'running', input, result: null, error: null },
      ])
      return body.id
    } catch (error) {
      throw error instanceof Error ? error : new Error('Could not start that.')
    }
  }, [])

  return {
    /** Everything in flight, whoever started it and on whichever page. */
    running,
    /** Everything already worked out, newest first. */
    solved,
    busy: (kind: Job['kind']) => running.some((job) => job.kind === kind),
    start,
  }
}
