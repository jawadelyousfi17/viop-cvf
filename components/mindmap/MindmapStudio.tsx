'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ROOT_ID,
  graft,
  mindmapToScene,
  nodeAt,
  toOutline,
  trailTo,
  type MindMap,
  type MindNode,
} from '@/lib/mindmap'
import { BoardCanvas, type View } from '../engine/BoardCanvas'
import { ImageBank } from '../images'
import { AuthPanel } from './AuthPanel'
import type { Lesson as LessonDocument } from '@/lib/lesson'
import WhiteboardStudio, {
  type LessonRequest,
  type LessonTransport,
} from '../whiteboard/WhiteboardStudio'
import { solutionToScene, type MathSolution } from '@/lib/math'
import { Composer, SPEED_MODELS, type Speed } from './Composer'
import { useTutorVoice } from './useTutorVoice'
import { useJobs, type Job } from './useJob'
import { Sidebar, type Mode, type SavedLesson } from './Sidebar'
import { IconClose, IconFit, IconFold, IconHint, IconShare, IconTarget } from './icons'
import { RaisingChip, RaisingDialog } from '../marketing/Raising'

import type { SavedMap } from './Sidebar'

/**
 * The mindmap page.
 *
 * Deliberately not the lesson player. A lesson is a performance — it has a
 * voice, a clock, scenes you move between, and most of that component exists to
 * keep the drawing in step with the talking. A map has none of that: it is one
 * board, put up at once, and then you read it.
 *
 * Nothing here imports the Narrator or touches /api/tts, and the scene it draws
 * arrives with an empty narration, so a map is silent by construction rather
 * than by remembering to mute it.
 *
 * The board is drawn by our own engine (components/engine) rather than tldraw.
 * A map is not an editable document, so an editor's scene graph, tool system
 * and history stack were being carried to draw sixty static paths — and the two
 * things the map does need, a hand-drawn line and knowing what was clicked,
 * are easier when the shapes are plain DOM.
 *
 * The map has no bottom. A node with children folds away when clicked; a node
 * without any is not the end of the map, it is the part nobody has asked about
 * yet — clicking it writes its children and grafts them on where it stands, as
 * far down as anyone cares to go. Only the tree is kept in state; the board is
 * laid out from it on every change, so growing a limb re-flows everything else
 * rather than pinning it to where it first landed.
 *
 * Maps persist. A new one is filed the moment it is drawn, and every expansion
 * after that is written back a moment later — a map someone has spent ten
 * clicks growing is worth more than the one they started with, and losing it to
 * a closed tab would make the whole thing feel disposable.
 */

type Phase = 'idle' | 'thinking' | 'board'

/** Remembers that the raise has been mentioned. Once is a remark; twice is an advert. */
const RAISING_SEEN = 'nipsol.raising.seen'

export default function MindmapStudio() {
  /**
   * Which of the two this workspace is doing.
   *
   * Both live here rather than on separate pages, and the switch is a switch of
   * what the composer means: the same input asks for a map or for a lesson. The
   * lesson player stays mounted while you are on the map side, so wandering
   * over to check something does not stop what it was saying.
   */
  const [mode, setMode] = useState<Mode>('lesson')
  /** Open once, just after someone's first lesson has finished saving. */
  const [raising, setRaising] = useState(false)
  /** Fast or thinking. One choice, read by both sides. */
  const [speed, setSpeed] = useState<Speed>('fast')
  /** What the composer last asked the lesson player for. */
  const [lesson, setLesson] = useState<LessonRequest | null>(null)
  const [lessonBusy, setLessonBusy] = useState(false)
  /** The playing lesson's controls, published by the player and drawn on the composer. */
  const [transport, setTransport] = useState<LessonTransport | null>(null)
  /** The worked solution on the board, when the tutor is the side showing. */
  const [solution, setSolution] = useState<MathSolution | null>(null)

  const [lessons, setLessons] = useState<SavedLesson[]>([])
  /** Which saved lesson is on the board, so the rail can mark it. */
  const [lessonId, setLessonId] = useState<string | null>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [topic, setTopic] = useState('')
  const [map, setMap] = useState<MindMap | null>(null)
  /** Node ids whose children are put away. */
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set())
  /** Node ids with an expansion in flight. */
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  /** Symbol art, by the query that asked for it, as the drawings come back. */
  const [symbols, setSymbols] = useState<Map<string, string>>(new Map())
  /**
   * Where the camera is pointed next. A new object each time, because the board
   * acts on the change and not on the value: the map re-lays out constantly, and
   * a camera that followed every re-layout would never settle.
   */
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** The row this map is saved as, once it has been filed. */
  const [savedId, setSavedId] = useState<string | null>(null)
  const [history, setHistory] = useState<SavedMap[]>([])
  const [opening, setOpening] = useState<string | null>(null)
  /**
   * A map that is laid out but not shown yet.
   *
   * Its symbols are drawn to order and land a few seconds after the branches
   * do. Revealing the board first means watching pictures pop in one at a time
   * around text that has already settled — so the map waits until it is whole
   * and then arrives finished.
   *
   * Only on the way in. An expansion adds its own symbols later and must not
   * take the whole board away while they arrive.
   */
  const [preparing, setPreparing] = useState(false)

  /**
   * The speed setting where the callbacks can read it without being rebuilt.
   * `draw` and `expand` are memoised on purpose; depending on a toggle would
   * rebuild them every time it moved.
   */
  const speedRef = useRef<Speed>(speed)
  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  /**
   * The job runner, reachable from callbacks defined above it.
   *
   * `useJobs` needs a handler that refers to nearly everything in this
   * component, so it is created last — and the actions that start jobs are
   * declared before it. A ref is the join.
   */
  const jobsRef = useRef<ReturnType<typeof useJobs>>(null as never)

  const imagesRef = useRef<ImageBank | null>(null)
  /** The tree as last written to the database, so a save is skipped when nothing changed. */
  const savedTreeRef = useRef<string>('')

  // The board is a pure function of the tree and what is folded, so a fold is
  // a whole new layout rather than a few shapes hidden in place.
  const scene = useMemo(
    () => (map ? mindmapToScene(map, { folded, pending }) : null),
    [map, folded, pending]
  )

  /** The tutor's board: a column of steps, laid out the same way a map is. */
  const mathScene = useMemo(() => (solution ? solutionToScene(solution) : null), [solution])

  /**
   * The camera follows the voice: each step is framed as it is spoken, which is
   * what makes a column taller than the window readable without scrolling.
   */
  const followVoice = useCallback((group: number) => {
    setView(group < 0 ? { type: 'fit' } : { type: 'focus', id: `s${group}` })
  }, [])

  /** The tutor reads its working aloud, a step at a time. */
  const tutor = useTutorVoice(solution, followVoice)

  /**
   * Only as far as the tutor has spoken.
   *
   * Showing the whole solution at once and then narrating it would let the eye
   * run to the answer while the voice is still on step two — which is the one
   * thing a worked solution must not do.
   */
  const mathShapes = useMemo(() => {
    if (!mathScene) return []
    return mathScene.shapes.filter((shape) => {
      const step = /^[sm](\d+)$/.exec(shape.id)
      if (step) return Number(step[1]) <= tutor.revealed
      // The problem is up from the start; the answer waits for the last line.
      if (shape.id === 'title' || shape.id === 'given') return true
      return tutor.revealed >= (solution?.steps.length ?? 0)
    })
  }, [mathScene, tutor.revealed, solution])

  const limbs = map?.root.children.length ?? 0
  const allFolded = limbs > 0 && Array.from({ length: limbs }, (_, i) => `${ROOT_ID}.${i}`).every((id) => folded.has(id))

  /**
   * Every symbol a tree asks for, resolved before the board is shown.
   *
   * Settled, not fulfilled: a lookup that comes back empty is an answer too,
   * and one term the model invented must not hold up the whole map.
   */
  const loadSymbols = useCallback(async (root: MindNode) => {
    const bank = (imagesRef.current ??= new ImageBank())
    const queries = new Set<string>()

    const walk = (node: MindNode) => {
      if (node.symbol?.trim()) queries.add(node.symbol.trim())
      for (const child of node.children) walk(child)
    }
    walk(root)

    await Promise.allSettled(
      [...queries].map(async (query) => {
        const found = await bank.get(query, 'symbol')
        if (!found) return
        const key = query.toLowerCase()
        setSymbols((current) =>
          current.get(key) === found.src ? current : new Map(current).set(key, found.src)
        )
      })
    )
  }, [])

  /** The history list. Re-read whenever who is asking might have changed. */
  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/mindmaps')
      const body = (await response.json()) as { maps?: SavedMap[] }
      return body.maps ?? []
    } catch {
      // History is a convenience; failing to list it is not worth an error.
      return null
    }
  }, [])

  const refreshHistory = useCallback(() => {
    void loadHistory().then((maps) => maps && setHistory(maps))
  }, [loadHistory])

  /** Lessons already taught, for the rail's other list. */
  const loadLessons = useCallback(async () => {
    try {
      const response = await fetch('/api/lessons')
      const body = (await response.json()) as { lessons?: SavedLesson[] }
      return body.lessons ?? []
    } catch {
      return null
    }
  }, [])

  const refreshLessons = useCallback(() => {
    void loadLessons().then((rows) => rows && setLessons(rows))
  }, [loadLessons])

  useEffect(() => {
    let cancelled = false
    void loadLessons().then((rows) => {
      if (!cancelled && rows) setLessons(rows)
    })
    return () => {
      cancelled = true
    }
  }, [loadLessons])

  /**
   * Files a lesson the moment it has finished streaming.
   *
   * Stored as the finished document rather than the topic: asking the model for
   * the same topic again returns a different lesson, and history that gives you
   * a different lesson than the one you watched is not history.
   */
  const keepLesson = useCallback(
    async (taught: LessonDocument) => {
      try {
        const response = await fetch('/api/lessons', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ topic: lesson?.topic ?? '', lesson: taught }),
        })
        const body = (await response.json()) as { lesson?: SavedLesson; error?: string }
        if (body.lesson) {
          setLessonId(body.lesson.id)
          setLessons((current) => [body.lesson!, ...current])

          // The moment the product has just proved itself to them, and the
          // only one where asking lands as a remark rather than an advert.
          // Once ever: the flag is written before the dialog opens, so a
          // second lesson in the same session cannot re-arm it.
          try {
            if (!localStorage.getItem(RAISING_SEEN)) {
              localStorage.setItem(RAISING_SEEN, '1')
              setRaising(true)
            }
          } catch {
            // Private browsing with storage denied. Not worth a word.
          }
        } else if (body.error) {
          setError(body.error)
        }
      } catch {
        setError('That lesson could not be saved.')
      }
    },
    [lesson]
  )

  /** Plays a saved lesson again, exactly as it was taught. */
  const openLesson = useCallback(async (id: string) => {
    setOpening(id)
    setError(null)
    try {
      const response = await fetch(`/api/lessons/${id}`)
      const body = (await response.json()) as {
        lesson?: { id: string; topic: string; document: LessonDocument }
        error?: string
      }
      if (!response.ok || !body.lesson) {
        setError(body.error ?? 'Could not open that lesson.')
        return
      }

      setMode('lesson')
      setLessonId(body.lesson.id)
      setLesson({ topic: body.lesson.topic, replay: body.lesson.document, key: Date.now() })
    } catch {
      setError('Could not reach the lesson service.')
    } finally {
      setOpening(null)
    }
  }, [])

  // On arrival, and again whenever signing in or out changes whose maps these
  // are. Guarded against the answer landing after the page has gone.
  useEffect(() => {
    let cancelled = false
    void loadHistory().then((maps) => {
      if (!cancelled && maps) setHistory(maps)
    })
    return () => {
      cancelled = true
    }
  }, [loadHistory])

  /**
   * Asks for a map. The answer arrives through the job poll, not from here.
   *
   * Which is the whole point: this function returns as soon as the work has
   * been *started*, so nothing about the map depends on this page still being
   * open when it is finished.
   */
  const draw = useCallback(
    async (nextTopic: string, nextOutline: string) => {
      if (!nextTopic.trim() && !nextOutline.trim()) return

      setError(null)
      try {
        await jobsRef.current.start('map', {
          topic: nextTopic.trim(),
          outline: nextOutline.trim() || undefined,
          heading: nextOutline.trim() ? nextTopic.trim() : undefined,
          model: SPEED_MODELS[speedRef.current],
        })
        setTopic('')
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Could not start that.')
      }
    },
    []
  )

  /**
   * Fetches the line art for each limb.
   *
   * A symbol is drawn to order and takes a few seconds, so it arrives after the
   * map does and appears when it lands. One that comes back empty simply never
   * appears — a placeholder box where a picture was meant to go is worse than
   * the picture being missing.
   */
  useEffect(() => {
    if (!scene) return
    const bank = (imagesRef.current ??= new ImageBank())

    let cancelled = false
    for (const shape of scene.shapes) {
      if (shape.kind !== 'symbol' || !shape.text.trim()) continue
      const query = shape.text.trim().toLowerCase()

      void bank.get(shape.text, 'symbol').then((found) => {
        if (cancelled || !found) return
        setSymbols((current) =>
          current.get(query) === found.src ? current : new Map(current).set(query, found.src)
        )
      })
    }

    return () => {
      cancelled = true
    }
  }, [scene])

  /**
   * Writes the tree back a moment after it stops changing.
   *
   * Debounced rather than saved per expansion: opening three nodes in a row is
   * one thought, and it should cost one write. The comparison against the last
   * saved tree is what keeps a fold — which changes the drawing but not the map
   * — from writing anything at all.
   */
  useEffect(() => {
    if (!map || !savedId) return
    const tree = JSON.stringify(map.root)
    if (tree === savedTreeRef.current) return

    const timer = setTimeout(() => {
      savedTreeRef.current = tree
      void fetch(`/api/mindmaps/${savedId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tree: map.root }),
      })
        .then(() => refreshHistory())
        .catch(() => {
          // Try again on the next change rather than blocking the board.
          savedTreeRef.current = ''
        })
    }, 1200)

    return () => clearTimeout(timer)
  }, [map, savedId, refreshHistory])

  /**
   * Works a problem, and puts the working on the board.
   *
   * The tutor keeps nothing yet: there is no table for solutions, so a new
   * question replaces the last one. Worth saying out loud rather than letting
   * someone discover it by losing something.
   */
  const work = useCallback(async (question: string) => {
    setError(null)
    try {
      await jobsRef.current.start('math', {
        question,
        model: SPEED_MODELS[speedRef.current],
      })
      setTopic('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not start that.')
    }
  }, [])

  /** Reopens a saved map, exactly as it was left. */
  const open = useCallback(async (id: string) => {
    setOpening(id)
    setError(null)
    try {
      const response = await fetch(`/api/mindmaps/${id}`)
      const body = (await response.json()) as {
        map?: { id: string; title: string; topic: string; mindmap: MindMap }
        error?: string
      }
      if (!response.ok || !body.map) {
        setError(body.error ?? 'Could not open that map.')
        return
      }

      setPreparing(true)
      void loadSymbols(body.map.mindmap.root).finally(() => setPreparing(false))

      setMap(body.map.mindmap)
      setTopic('')
      setSavedId(body.map.id)
      savedTreeRef.current = JSON.stringify(body.map.mindmap.root)
      setFolded(new Set())
      setPending(new Set())
      setView({ type: 'fit' })
      setPhase('board')
    } catch {
      setError('Could not reach the map service.')
    } finally {
      setOpening(null)
    }
  }, [loadSymbols])

  const toggleFold = useCallback(
    (id: string) =>
      setFolded((current) => {
        const next = new Set(current)
        if (!next.delete(id)) next.add(id)
        return next
      }),
    []
  )

  const foldAll = useCallback(() => {
    const ids = Array.from({ length: limbs }, (_, i) => `${ROOT_ID}.${i}`)
    setFolded((current) => (ids.every((id) => current.has(id)) ? new Set() : new Set(ids)))
    setView({ type: 'fit' })
  }, [limbs])

  /**
   * Writes the children of one node and grafts them on where it stands.
   *
   * The node is marked pending first, so the board says it is being thought
   * about rather than sitting there looking broken for the second or two the
   * model takes.
   */
  const expand = useCallback(
    async (id: string) => {
      const current = map
      if (!current || pending.has(id)) return

      setPending((set) => new Set(set).add(id))
      try {
        await jobsRef.current.start('expand', {
          trail: trailTo(current.root, id),
          node: id,
          model: SPEED_MODELS[speedRef.current],
        })
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Could not open that up.')
        setPending((set) => {
          const next = new Set(set)
          next.delete(id)
          return next
        })
      }
    },
    [map, pending]
  )

  /**
   * One click, two meanings, decided by what is under the node: a node that has
   * children folds them away, and a node that has none goes and gets some.
   */
  const onShapeClick = useCallback(
    (shapeId: string) => {
      if (!map) return
      // A node's symbol and its explanation are part of the node, not shapes in
      // their own right — `n.0.2s` and `n.0.2d` are both `n.0.2`.
      const id = shapeId.replace(/[sd]$/, '')
      const node = nodeAt(map.root, id)
      if (!node) return

      if (id === ROOT_ID) {
        foldAll()
        return
      }
      if (node.children.length) {
        toggleFold(id)
        setView({ type: 'focus', id })
        return
      }
      void expand(id)
    },
    [map, foldAll, toggleFold, expand]
  )

  const startOver = useCallback(() => {
    setMap(null)
    setFolded(new Set())
    setPending(new Set())
    setPhase('idle')
  }, [])

  /**
   * The map as an outline, downloaded.
   *
   * The same syntax the composer accepts, so what comes out can be edited and
   * handed straight back — export and import are one format, not two.
   */
  const exportOutline = useCallback(() => {
    if (!map) return
    const name = (map.heading || map.root.text).replace(/[^\w -]+/g, '').trim() || 'mindmap'
    const file = new Blob([toOutline(map.root)], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(file)

    const link = document.createElement('a')
    link.href = url
    link.download = `${name}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }, [map])

  /**
   * Files a finished map and puts it at the top of the rail.
   *
   * Separate from drawing it, because a map can now arrive from a job started
   * by a page that no longer exists — the keeping of it cannot live inside the
   * function that asked for it.
   */
  const keepMap = useCallback(async (mindmap: MindMap, topic: string) => {
    savedTreeRef.current = JSON.stringify(mindmap.root)
    setSavedId(null)
    try {
      const stored = await fetch('/api/mindmaps', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: mindmap.heading || mindmap.root.text,
          topic,
          source: 'model',
          tree: mindmap.root,
        }),
      })
      const saved = (await stored.json()) as { map?: SavedMap; error?: string }
      if (saved.map) {
        setSavedId(saved.map.id)
        setHistory((current) => [saved.map!, ...current.filter((m) => m.id !== saved.map!.id)])
      } else if (saved.error) {
        setError(saved.error)
      }
    } catch {
      setError('That map could not be saved.')
    }
  }, [])

  /**
   * Work that outlives this page.
   *
   * Every generation is started as a job and picked up by polling, so a reload
   * mid-thought loses the view and not the work — and arriving on the page
   * adopts whatever was already running.
   */
  const jobs = useJobs(
    useCallback((job: Job) => {
      if (job.status === 'failed') {
        setError(job.error ?? 'That did not finish.')
        return
      }

      const result = job.result as Record<string, unknown> | null
      if (!result) return

      if (job.kind === 'map' && result.mindmap) {
        const mindmap = result.mindmap as MindMap
        setPreparing(true)
        void loadSymbols(mindmap.root).finally(() => setPreparing(false))
        setMap(mindmap)
        setFolded(new Set())
        setPending(new Set())
        setView({ type: 'fit' })
        setPhase('board')
        setMode('map')
        void keepMap(mindmap, String((job.input as Record<string, unknown>)?.topic ?? ''))
        return
      }

      if (job.kind === 'expand' && Array.isArray(result.children)) {
        const node = String(result.node ?? '')
        setMap((latest) =>
          latest && node
            ? { ...latest, root: graft(latest.root, node, result.children as MindNode[]) }
            : latest
        )
        setPending((set) => {
          const next = new Set(set)
          next.delete(node)
          return next
        })
        if (node) setView({ type: 'focus', id: node })
        return
      }

      if (job.kind === 'math' && result.solution) {
        setSolution(result.solution as MathSolution)
        setMode('math')
        setView({ type: 'fit' })
      }
    }, [loadSymbols, keepMap])
  )

  // Written after the render, not during it: the actions above only ever read
  // it from inside a callback, which runs long after this has settled.
  useEffect(() => {
    jobsRef.current = jobs
  })

  /** The composer's one action, aimed at whichever side is showing. */
  const submit = useCallback(() => {
    if (mode === 'math') {
      if (!topic.trim() || jobs.busy('math')) return
      void work(topic.trim())
      return
    }
    if (mode === 'lesson') {
      if (!topic.trim()) return

      // With a lesson on the board the same box asks it questions instead of
      // throwing it away and starting another — that is what New lesson is for.
      if (transport) {
        transport.ask(topic.trim())
        setTopic('')
        return
      }
      // Keyed on the clock: asking for the same topic twice means two lessons.
      setLesson({ topic: topic.trim(), key: Date.now() })
      return
    }
    void draw(topic, '')
  }, [mode, topic, draw, transport, jobs, work])

  const fitToScreen = useCallback(() => setView({ type: 'fit' }), [])
  const centreOnRoot = useCallback(() => setView({ type: 'focus', id: ROOT_ID }), [])

  /**
   * The same three things from the keyboard.
   *
   * A map is read with one hand on the trackpad, and reaching for a button at
   * the foot of the screen to get back to the middle costs more than the trip
   * is worth. The keys are written on the buttons, so nobody has to be told
   * they exist.
   *
   * Bound only while a map is on screen, and never while something is being
   * typed into — a topic with the letter "f" in it would otherwise fold the map
   * as you wrote it.
   */
  useEffect(() => {
    if (phase !== 'board') return

    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target as HTMLElement | null
      if (target?.isContentEditable) return
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return

      switch (event.key) {
        case 'Escape':
          startOver()
          break
        case 'f':
        case 'F':
          foldAll()
          break
        case 'r':
        case 'R':
          centreOnRoot()
          break
        case '0':
          fitToScreen()
          break
        default:
          return
      }
      event.preventDefault()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, startOver, foldAll, centreOnRoot, fitToScreen])

  return (
    <div className="flex h-dvh bg-[#f4f6f8] text-zinc-900">
      <Sidebar
        history={history}
        currentId={mode === 'lesson' ? lessonId : savedId}
        opening={opening}
        lessons={lessons}
        mode={mode}
        onOpen={async (id) => {
          if (mode === 'lesson') return openLesson(id)
          // Opening a map is also a way of saying which side you want.
          setMode('map')
          await open(id)
        }}
        onNew={() => {
          if (mode === 'math') return setSolution(null)
          if (mode === 'map') return startOver()
          // Clears the board as well as the request; otherwise "New lesson"
          // leaves the last one still playing behind the welcome.
          transport?.reset()
          setLesson(null)
          setLessonId(null)
        }}
        onIdentityChange={refreshHistory}
      />

      <main className="flex min-w-0 flex-1 flex-col bg-white">
        {/* What is open, and what you can do to it. The map's own controls only
            exist while there is a map — an empty panel with a "fold everything"
            button on it is a lie about what is there. */}
        <div className="flex h-[52px] shrink-0 items-center gap-2 px-4">
          <p className="min-w-0 flex-1 truncate px-1.5 text-[14px] font-medium text-zinc-600">
            {mode === 'lesson'
              ? (lesson?.topic ?? '')
              : mode === 'math'
                ? (solution?.title ?? '')
                : scene
                  ? map?.heading || map?.root.text
                  : ''}
          </p>

          {mode === 'map' && scene && (
            <>
              <button
                type="button"
                onClick={exportOutline}
                className="flex h-9 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 text-[12.5px] text-zinc-700 transition hover:text-zinc-900"
              >
                <IconShare className="size-4" />
                Export
              </button>
              <ToolButton onClick={foldAll} label={allFolded ? 'Unfold everything' : 'Fold everything'} hint="F" below>
                <IconFold className="size-4" />
              </ToolButton>
              <ToolButton onClick={centreOnRoot} label="Back to the middle" hint="R" below>
                <IconTarget className="size-4" />
              </ToolButton>
              <ToolButton onClick={fitToScreen} label="See the whole map" hint="0" below>
                <IconFit className="size-4" />
              </ToolButton>
              {/* Closing the map is the same act as starting a new one, but it
                  belongs here as well as in the rail: this bar is where the
                  things you do TO the open map are, and putting the way out of
                  it anywhere else makes leaving feel like navigating away. */}
              <ToolButton onClick={startOver} label="Close this map" hint="Esc" below>
                <IconClose className="size-4" />
              </ToolButton>
            </>
          )}

          <RaisingChip />
        </div>

        {/* One panel for both states. The board used to take over the window,
            which made history, the account and starting again places you had to
            leave your work to reach. */}
        {/* No frame and no margin: the board is the page on this side, and a
            rounded card around it was a border between someone and the thing
            they came to look at. */}
        <section className="relative min-h-0 flex-1 overflow-hidden bg-white">
          {/* Kept mounted either way. A lesson is a performance with audio in
              flight; unmounting it to glance at a map would stop it mid-word,
              so the inactive side is hidden rather than thrown away. */}
          {mode === 'math' && mathScene && (
            <BoardCanvas shapes={mathShapes} view={view} paper="ruled" className="absolute inset-0" />
          )}

          <div className={mode === 'lesson' ? 'absolute inset-0' : 'hidden'}>
            <WhiteboardStudio
              engine="whiteboard"
              embedded
              request={lesson}
              onBusy={setLessonBusy}
              onTransport={setTransport}
              onTaught={(taught) => void keepLesson(taught).then(refreshLessons)}
            />
          </div>

          {mode === 'map' &&
            (preparing ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 pb-40">
                <span className="size-2.5 animate-pulse rounded-full bg-zinc-900" />
                <p className="text-[14px] text-zinc-400">Drawing the board…</p>
              </div>
            ) : scene ? (
            <BoardCanvas
              shapes={scene.shapes}
              symbols={symbols}
              view={view}
              onShapeClick={onShapeClick}
              className="absolute inset-0"
            />
            ) : (
              <div className="h-full overflow-y-auto">
                {/* Narrow screens have no rail, so history lives here instead. */}
                <div className="px-6 pb-40 pt-6 lg:hidden">
                  <History history={history} opening={opening} onOpen={open} />
                  <div className="mt-5">
                    <AuthPanel onChange={refreshHistory} />
                  </div>
                </div>
              </div>
            ))}

          {/* The tips are for the first map and in the way of every one after
              it, so they fold into the corner and come back on hover. The group
              is focusable so the popover is reachable from the keyboard too — a
              hover-only affordance is one some people simply do not have. */}
          {mode === 'map' && scene && (
            <div className="group absolute left-4 top-4">
              <button
                type="button"
                aria-label="How to use the map"
                className="flex size-9 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-zinc-400 shadow-sm backdrop-blur transition hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
              >
                <IconHint className="size-4" />
              </button>
              <p className="pointer-events-none invisible absolute left-0 top-11 w-80 select-none rounded-xl border border-black/10 bg-white/95 px-4 py-3.5 text-[13.5px] leading-relaxed text-zinc-600 opacity-0 shadow-lg shadow-black/5 backdrop-blur transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                Click the end of a limb to grow it further; click a node that already has
                branches to fold it away. Drag to move, ⌘-scroll to zoom, double-click to
                see the whole map.
              </p>
            </div>
          )}

          {error && (
            <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-5">
              <button
                type="button"
                onClick={() => setError(null)}
                className="pointer-events-auto rounded-xl border border-red-100 bg-red-50/95 px-4 py-2.5 text-[13px] text-red-700 shadow-sm backdrop-blur"
              >
                {error} — dismiss
              </button>
            </div>
          )}

          {/* The one input, in the same place whether the panel is empty or
              holds a map: asking for the next map is the same gesture either
              way, and a board that hides it makes starting again a trip. */}
          <Composer
            mode={mode}
            onMode={setMode}
            centred={mode === 'map' ? !scene : mode === 'math' ? !solution : !transport}
            transport={
              mode === 'lesson'
                ? transport
                : mode === 'math' && solution
                  ? {
                      playing: tutor.playing,
                      finished: tutor.finished,
                      atEdge: false,
                      drawing: false,
                      asking: false,
                      hasPrev: tutor.hasPrev,
                      hasNext: tutor.hasNext,
                      progress: `step ${tutor.step} of ${tutor.steps}`,
                      toggle: tutor.finished ? tutor.replay : tutor.toggle,
                      prev: tutor.prev,
                      next: tutor.next,
                      // The tutor takes a new problem, not a question about
                      // this one — the composer's box already does that.
                      ask: (question: string) => void work(question),
                      reset: () => setSolution(null),
                    }
                  : null
            }
            speed={speed}
            onSpeed={setSpeed}
            topic={topic}
            busy={
              mode === 'lesson'
                ? lessonBusy
                : mode === 'math'
                  ? jobs.busy('math')
                  : jobs.busy('map') || jobs.busy('expand')
            }
            onTopic={setTopic}
            onSubmit={submit}
          />
        </section>
      </main>

      <RaisingDialog open={raising} onClose={() => setRaising(false)} />
    </div>
  )
}

/**
 * One button on the map's toolbar.
 *
 * Icon only, with the name and its key revealed on hover — a row of three
 * labelled buttons is wider than the map's own root node, and this bar sits
 * over the drawing. The label doubles as the accessible name, so what a screen
 * reader announces and what the tooltip says cannot drift apart.
 */
function ToolButton({
  onClick,
  label,
  hint,
  below = false,
  children,
}: {
  onClick: () => void
  label: string
  hint: string
  /** Tooltip under the button rather than over it, for a bar along the top. */
  below?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={`${label} (${hint})`}
        className="flex size-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
      >
        {children}
      </button>
      <span className={`pointer-events-none invisible absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${below ? 'top-10' : 'bottom-12'}`}>
        {label}
        <kbd className="rounded border border-white/25 px-1 font-sans text-[10px] leading-4 text-white/80">
          {hint}
        </kbd>
      </span>
    </div>
  )
}

/**
 * Everything this browser (or this account) has mapped.
 *
 * One component for both places it appears — the sidebar on a wide screen and
 * under the input on a narrow one — because two copies of a list drift, and the
 * one that drifts is always the one nobody is looking at.
 */
function History({
  history,
  opening,
  onOpen,
}: {
  history: SavedMap[]
  opening: string | null
  onOpen: (id: string) => Promise<void>
}) {
  if (!history.length) {
    return (
      <p className="px-2 py-3 text-sm leading-relaxed text-zinc-400">
        Maps you make are kept here.
      </p>
    )
  }

  return (
    <>
      <h2 className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
        Your maps
      </h2>
      <ul className="flex flex-col">
        {history.map((entry) => (
          <li key={entry.id} className="group flex items-center gap-1">
            <button
              type="button"
              onClick={() => void onOpen(entry.id)}
              disabled={Boolean(opening)}
              className="flex-1 rounded-lg px-2 py-2 text-left transition hover:bg-zinc-100 disabled:opacity-50"
            >
              <span className="block truncate text-sm text-zinc-800">{entry.title}</span>
              <span className="mt-0.5 block truncate text-xs text-zinc-400">
                {entry.nodeCount} nodes · {entry.depth} deep · {when(entry.updatedAt)}
                {opening === entry.id ? ' · opening…' : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

/** "3 minutes ago", roughly — a history list does not need a clock. */
function when(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 90) return 'just now'
  const minutes = seconds / 60
  if (minutes < 60) return `${Math.round(minutes)} min ago`
  const hours = minutes / 60
  if (hours < 24) return `${Math.round(hours)}h ago`
  return `${Math.round(hours / 24)}d ago`
}
