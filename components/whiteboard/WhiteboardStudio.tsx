'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  estimateNarrationSeconds,
  finishEachBox,
  holdInsideParents,
  normalizeLesson,
  oneAtATime,
  sceneHold,
  type Lesson,
} from '@/lib/lesson'
import type { LessonEvent } from '@/lib/lesson-stream'
import type { Engine } from '@/lib/engines'
import { DEFAULT_VOICE_ID, type VoiceId } from '@/lib/voices'
import type { LessonPainter } from '../engine/LessonBoard'
import { ImageBank } from '../images'
import { CHART_KINDS, chartKey } from '@/lib/chart'
import { renderChart } from '../charts'
import { Narrator } from '../narrator'
import { parseScript } from '@/lib/script-import'
import { Logo } from '../ui/Logo'

// The board draws in the browser and is heavy — keep it out of the server
// bundle and off the critical path for the topic screen.
//
// It used to be tldraw. tldraw needs a licence to run in production, so the
// same five methods are now served by our own SVG engine; ./board and ./paint
// are still here, unused, if that ever reverses.
const Board = dynamic(() => import('../engine/LessonBoard').then((m) => m.LessonBoard), {
  ssr: false,
})

const SUGGESTIONS = [
  'How does HTTPS actually keep my traffic private?',
  'Why do neural networks need activation functions?',
  'The Krebs cycle, but only the parts that matter',
  'What causes the northern lights?',
]

const LOADING_LINES = [
  'Reading up on your topic…',
  'Sketching out the board…',
  'Deciding what to draw first…',
]

type Phase = 'idle' | 'generating' | 'board'

/** Every picture a scene will need, photographs and symbols alike. */
function imageQueries(scene: { shapes: { kind: string; text: string }[] }) {
  return scene.shapes
    .filter((s) => (s.kind === 'image' || s.kind === 'symbol') && s.text.trim())
    .map((s) => ({ query: s.text, kind: s.kind as 'image' | 'symbol' }))
}

/** Reads the route's newline-delimited JSON events as they arrive. */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<LessonEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.trim()) yield JSON.parse(line) as LessonEvent
      }
    }
    if (buffer.trim()) yield JSON.parse(buffer) as LessonEvent
  } finally {
    reader.releaseLock()
  }
}

/**
 * Driven from outside, when the player is embedded in the workspace.
 *
 * `key` is what starts a lesson: the same topic asked for twice is two
 * lessons, and a value-only comparison would silently refuse the second.
 */
/**
 * What writes and draws a lesson.
 *
 * Fixed, and not the composer's fast/thinking switch. A lesson is a script
 * written by one model and a board drawn by another from that script, and the
 * quality of both is what the whole thing is; the faster model writes a
 * noticeably worse lesson. The switch belongs to the map and the tutor, where
 * the trade is worth offering.
 */
const LESSON_MODEL = 'gpt-5.6-terra'

export interface LessonRequest {
  topic: string
  script?: string
  /**
   * A lesson that has already been taught, to play again.
   *
   * Replay is not regeneration: asking the model for the same topic twice
   * returns a different lesson, and what someone reopening their history wants
   * is the one they watched.
   */
  replay?: Lesson
  key: number
}

/**
 * The lesson's controls, handed to whoever is drawing the chrome.
 *
 * The transport used to float over the board in a pill of its own. It belongs
 * with the composer instead: that is where every other instruction to this app
 * is typed, and a board with its own controls means two places to look
 * depending on which half of the product you are in.
 */
export interface LessonTransport {
  playing: boolean
  finished: boolean
  /** The script goes on, but the next scene has not been drawn (and costs money). */
  atEdge: boolean
  drawing: boolean
  hasPrev: boolean
  hasNext: boolean
  /** How much of a script is drawn, when the lesson came from one. */
  progress: string | null
  asking: boolean
  toggle: () => void
  prev: () => void
  next: () => void
  ask: (question: string) => void
  reset: () => void
}

export default function Studio({
  engine,
  embedded = false,
  request = null,
  onBusy,
  onTransport,
  onTaught,
}: {
  engine: Engine
  /**
   * Rendered inside the workspace panel rather than owning the window.
   *
   * Two differences, both about who is in charge: the board fills its parent
   * instead of the viewport, and the topic screen is gone — the workspace's
   * composer asks for the lesson, so a second input inside the panel would be
   * two ways to do one thing.
   */
  embedded?: boolean
  request?: LessonRequest | null
  onBusy?: (busy: boolean) => void
  /** Publishes the controls upward, and null once there is nothing to control. */
  onTransport?: (transport: LessonTransport | null) => void
  /** A lesson that has finished streaming, for the workspace to keep. */
  onTaught?: (lesson: Lesson) => void
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [topic, setTopic] = useState('')
  /** A finished script to draw, instead of a topic to invent one for. */
  const [script, setScript] = useState('')
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** The lesson title, shown on the loading screen before scene one arrives. */
  const [pendingTitle, setPendingTitle] = useState<string | null>(null)

  const [sceneIndex, setSceneIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [finished, setFinished] = useState(false)
  // One voice, set by the deployment. The picker is gone, so nothing changes it.
  const voiceId: VoiceId = DEFAULT_VOICE_ID
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  /**
   * Everything taught this session, oldest first. Threaded into each new
   * lesson so a series builds instead of restarting from scratch each time.
   */
  const [history, setHistory] = useState<{ title: string; summary: string }[]>([])

  const painterRef = useRef<LessonPainter | null>(null)
  const narratorRef = useRef<Narrator | null>(null)
  const imagesRef = useRef<ImageBank | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef(false)
  const [painterReady, setPainterReady] = useState(false)

  // The lesson grows while it plays, so the animation loop reads it through a
  // ref. Depending on the `lesson` object itself would restart the current
  // scene every time a new one streams in.
  const lessonRef = useRef<Lesson | null>(null)
  const waitingRef = useRef(false)
  const streamingRef = useRef(false)

  /**
   * A script being drawn a scene at a time.
   *
   * Drawing a fifteen-scene script in one call spends fifteen scenes' worth of
   * tokens before you have seen whether the first one is any good. So a script
   * is drawn on demand: one scene when you press run, the next when you ask for
   * it. The total comes from the server, which is the only side that knows how
   * the script divides; `next` is the block to ask for, and it is counted
   * separately from the scene index because a question inserts a scene that was
   * never in the script.
   */
  const planRef = useRef<{ script: string; total: number; next: number } | null>(null)
  const [plan, setPlan] = useState<{ total: number; next: number } | null>(null)
  /** Set while a scene is being fetched, so one request can't be sent twice. */
  const drawingRef = useRef(false)
  const [drawing, setDrawing] = useState(false)
  /**
   * The scene ended and the next one has not been drawn yet.
   *
   * Distinct from `finished`: the lesson is not over, it is waiting to be paid
   * for. Play and next both mean "draw it and carry on" while this is set.
   */
  const [atEdge, setAtEdge] = useState(false)
  /** Set while the board is showing something out of history, not a new lesson. */
  const replayingRef = useRef(false)
  /** Bumped per lesson so a stale stream can't write into a newer one. */
  const runIdRef = useRef(0)

  // Mirrors `isPlaying` where the animation loop can read it, and keeps the
  // audio element in step with the play/pause button. Declared before the scene
  // effect so the ref is already correct when a new scene starts.
  useEffect(() => {
    playingRef.current = isPlaying
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) void audio.play().catch(() => setIsPlaying(false))
    else audio.pause()
  }, [isPlaying, sceneIndex])

  /**
   * Takes the board as it mounts.
   *
   * A callback ref rather than an effect reading painterRef: the board is a
   * dynamic import, so it mounts some time *after* this component's own
   * effects have run, and an effect that looked once on mount found nothing
   * and left the player believing it had no board for the rest of the session.
   * React calls this the moment the handle exists, whenever that is.
   */
  const takeBoard = useCallback((painter: LessonPainter | null) => {
    painterRef.current = painter
    setPainterReady(Boolean(painter))
  }, [])

  useEffect(() => {
    return () => {
      narratorRef.current?.dispose()
      audioRef.current?.pause()
    }
  }, [])

  /**
   * A lesson asked for from the workspace's composer.
   *
   * Keyed on `request.key` rather than the topic: asking for the same topic
   * twice is two lessons, and comparing values would quietly refuse the second.
   * `generate` is redefined on every render, so it is deliberately not a
   * dependency — this fires when a new request arrives and at no other time.
   */
  const requestKey = request?.key
  useEffect(() => {
    if (!requestKey || !request) return

    // A saved lesson goes straight to the board; nothing is written again.
    if (request.replay) {
      replayingRef.current = true
      start(request.replay)
      return
    }
    replayingRef.current = false
    if (!request.topic.trim()) return
    void generate(request.topic, request.script)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  // What the composer shows while a lesson is being written.
  useEffect(() => {
    onBusy?.(phase === 'generating')
  }, [phase, onBusy])

  const start = useCallback((next: Lesson) => {
    narratorRef.current?.dispose()
    narratorRef.current = new Narrator(voiceId)
    imagesRef.current = new ImageBank()
    painterRef.current?.reset()

    lessonRef.current = next
    waitingRef.current = false

    // Kick the first voiceover off now rather than when the scene effect runs:
    // it overlaps the TTS request with tldraw mounting, which is otherwise
    // several seconds of dead time.
    if (next.scenes[0]) {
      narratorRef.current.prefetch(next.scenes[0].narration)
      imagesRef.current.prefetch(imageQueries(next.scenes[0]))
    }

    setLesson(next)
    setSceneIndex(0)
    setFinished(false)
    setAtEdge(false)
    setIsPlaying(true)
    setPhase('board')
  }, [voiceId])

  /** Appends a streamed scene and, if playback was holding for it, resumes. */
  const addScene = useCallback((event: Extract<LessonEvent, { type: 'scene' }>) => {
    const current = lessonRef.current
    if (!current) return

    // Image lookups are slow — a search, a proxied fetch and a decode. Starting
    // them the moment a scene arrives rather than when it plays usually buys
    // enough head start for the picture to beat the narration to it.
    imagesRef.current?.prefetch(imageQueries(event.scene))

    const scenes = [...current.scenes, event.scene]
    // Each section's voice is its own TTS request, kicked off the moment the
    // scene arrives — the first section starts as soon as it is ready, and by
    // the time playback reaches the rest their audio is already on hand.
    narratorRef.current?.prefetch(event.scene.narration)
    const next = { ...current, scenes }
    lessonRef.current = next
    setLesson(next)

    if (waitingRef.current) {
      waitingRef.current = false
      setSceneIndex(scenes.length - 1)
    }
  }, [])

  /**
   * Draws the next block of a script that is being drawn on demand.
   *
   * Returns whether there was anything left to draw, so the caller can tell
   * "one moment" apart from "that was the end of the script".
   */
  const drawNext = useCallback(async () => {
    const pending = planRef.current
    if (!pending || drawingRef.current || pending.next >= pending.total) return false

    drawingRef.current = true
    setDrawing(true)
    setError(null)
    const runId = runIdRef.current

    try {
      const response = await fetch('/api/lesson', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          script: pending.script,
          from: pending.next,
          count: 1,
          // What the boards so far were built on. Each scene is drawn in its
          // own request, so without this the model has no way of knowing it
          // has already made this exact board four times.
          forms: (lessonRef.current?.scenes ?? []).map((scene) => scene.form).filter(Boolean),
          engine,
          provider: 'openai',
          model: LESSON_MODEL,
        }),
      })
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? `Request failed (${response.status})`)
      }

      for await (const event of readEvents(response.body)) {
        if (runIdRef.current !== runId) return false

        if (event.type === 'scene') {
          const drawn = { ...pending, next: pending.next + 1 }
          planRef.current = drawn
          setPlan({ total: drawn.total, next: drawn.next })
          addScene(event)
        } else if (event.type === 'error') {
          throw new Error(event.message)
        }
      }
      return true
    } catch (cause) {
      if (runIdRef.current !== runId) return false
      // Nothing is lost — the scenes already drawn stay playable, and the
      // button can be pressed again.
      waitingRef.current = false
      setIsPlaying(false)
      setError(cause instanceof Error ? cause.message : 'Could not draw the next scene.')
      return false
    } finally {
      drawingRef.current = false
      setDrawing(false)
    }
  }, [addScene, engine])

  /**
   * Draws the scene the lesson is waiting on, and plays it.
   *
   * What both "next" and "play" mean once playback has run to the end of what
   * has been drawn and the script still has more in it.
   */
  const carryOn = useCallback(async () => {
    setAtEdge(false)
    waitingRef.current = true
    if (await drawNext()) setIsPlaying(true)
    else waitingRef.current = false
  }, [drawNext])

  // `/?demo=1` plays a hand-written lesson, so the board can be seen working
  // before any keys are set up.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('demo')) return
    void import('@/lib/demo-lesson').then(({ DEMO_LESSON }) => start(DEMO_LESSON))
  }, [start])

  async function generate(nextTopic: string, script?: string) {

    const trimmed = nextTopic.trim()
    const scripted = script?.trim() ?? ''
    if (!trimmed && !scripted) return

    const runId = ++runIdRef.current
    const isCurrent = () => runIdRef.current === runId

    setError(null)
    setPendingTitle(null)
    setPhase('generating')
    planRef.current = null
    setPlan(null)

    // A pasted script is drawn one scene at a time. A topic is first written
    // out as a script, then drawn — the writer never thinks about boxes, the
    // illustrator never edits prose. gpt-5.6-terra does both jobs, in separate
    // calls with separate prompts.
    const pasted = scripted
    const onDemand = pasted.length > 0

    let started = false
    let pendingMeta: Extract<LessonEvent, { type: 'meta' }> | null = null

    const fail = (message: string) => {
      if (!isCurrent()) return
      // Once the board is up, a late failure just stops the lesson early —
      // whatever already streamed in stays playable.
      if (started) streamingRef.current = false
      else {
        setError(message)
        setPhase('idle')
      }
    }

    try {
      let drawScript = pasted
      if (!drawScript) {
        setPendingTitle(trimmed)
        const written = await fetch('/api/script', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ topic: trimmed, history }),
        })
        const data = await written.json().catch(() => null)
        if (!written.ok) throw new Error(data?.error ?? `Request failed (${written.status})`)
        if (!isCurrent()) return
        drawScript = String(data?.script ?? '').trim()
        if (!drawScript) throw new Error('No script came back.')
      }

      const response = await fetch('/api/lesson', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: trimmed,
          script: drawScript,
          history,
          engine,
          provider: 'openai',
          model: LESSON_MODEL,
          ...(onDemand ? { from: 0, count: 1 } : {}),
        }),
      })

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? `Request failed (${response.status})`)
      }
      streamingRef.current = true

      for await (const event of readEvents(response.body)) {
        if (!isCurrent()) return

        if (event.type === 'plan') {
          // How many scenes the script comes to. Only the first is on its way.
          if (onDemand) {
            planRef.current = { script: drawScript, total: event.total, next: 0 }
            setPlan({ total: event.total, next: 0 })
          }
        } else if (event.type === 'meta') {
          if (started) setLesson((prev) => (prev ? { ...prev, title: event.title } : prev))
          else {
            // Arrives a few seconds before scene one — show it so the wait has
            // something to say for itself.
            pendingMeta = event
            setPendingTitle(event.title)
          }
        } else if (event.type === 'scene') {
          if (planRef.current) {
            const drawn = { ...planRef.current, next: planRef.current.next + 1 }
            planRef.current = drawn
            setPlan({ total: drawn.total, next: drawn.next })
          }
          if (!started) {
            started = true
            start({
              title: pendingMeta?.title || trimmed || 'Your script',
              summary: pendingMeta?.summary ?? '',
              scenes: [event.scene],
            })
          } else {
            addScene(event)
          }
        } else if (event.type === 'error') {
          fail(event.message)
          return
        }
      }

      if (!isCurrent()) return
      if (!started) throw new Error('The model returned a lesson with no scenes.')
      streamingRef.current = false

      // A script drawn on demand has barely started: there is no lesson to
      // summarise yet, and suggesting follow-up questions after scene one is a
      // request paid for and thrown away.
      const more = Boolean(planRef.current && planRef.current.next < planRef.current.total)

      const finishedLesson = more ? null : lessonRef.current
      if (finishedLesson) {
        setHistory((prev) => [
          ...prev,
          { title: finishedLesson.title, summary: finishedLesson.summary },
        ])
        // Fully streamed in, so it is worth keeping — but a replay is already
        // in history, and saving it again would file a duplicate every watch.
        if (!replayingRef.current) onTaught?.(finishedLesson)
      }

      // Playback was holding for a scene that will now never arrive.
      if (waitingRef.current && !more) {
        waitingRef.current = false
        setIsPlaying(false)
        setFinished(true)
      }
    } catch (cause) {
      streamingRef.current = false
      fail(cause instanceof Error ? cause.message : 'Something went wrong.')
    }
  }

  const scene = lesson?.scenes[sceneIndex]
  /** Whether the script goes on past what has been drawn. */
  const hasMore = Boolean(plan && plan.next < plan.total)
  const sceneId = scene?.id

  // Scene lifecycle: move the camera, start the narration, and reveal shapes as
  // the voice reaches them. Pause/resume is handled inside the loop so it never
  // restarts the scene, and it keys off the scene's id rather than the lesson
  // so newly streamed scenes don't interrupt the one playing.
  useEffect(() => {
    const painter = painterRef.current
    const narrator = narratorRef.current
    if (phase !== 'board' || !painter || !narrator) return

    const scene = lessonRef.current?.scenes[sceneIndex]
    if (!scene) return

    let cancelled = false
    let frame = 0
    let audio: HTMLAudioElement | null = null

    // Open tight on whatever leads the scene, then let maybeReframe pull back
    // as the board fills. Framing everything up front gives a static wide shot.
    // Open on the whole scene now that content is centred in the board, then
    // let maybeReframe follow the work as it fills in.
    // Sketch the link down from the previous scene, so the scroll reads as one
    // continuous board rather than a stack of separate pages.
    if (sceneIndex > 0) painter.connect(sceneIndex - 1)

    painter.focus(sceneIndex, scene.shapes)

    // Image lookups run in parallel with the voiceover, so a picture is
    // usually decoded before the narration reaches it.
    const bank = imagesRef.current
    if (bank) {
      for (const shape of scene.shapes) {
        if ((shape.kind !== 'image' && shape.kind !== 'symbol') || !shape.text.trim()) continue
        void bank.get(shape.text, shape.kind).then((found) => {
          if (!cancelled && found) painter.addImage(shape.text, found)
        })
      }
    }

    // Charts are rasterised server-side and arrive the same way a photograph
    // does: a dashed frame first, the picture when it lands.
    for (const shape of scene.shapes) {
      if (!(CHART_KINDS as readonly string[]).includes(shape.kind) || !shape.data.length) continue
      void renderChart(shape).then((found) => {
        if (!cancelled && found) painter.addImage(chartKey(sceneIndex, shape.id), found)
      })
    }

    // Anything due at the very first word is drawn before the audio resolves,
    // otherwise the board sits blank for as long as the voice takes to fetch.
    // Scenes no longer open with a title, so if nothing is scheduled at zero,
    // draw whichever shape comes first rather than leaving the canvas empty.
    const opensAt = scene.shapes.filter((s) => s.at <= 0.001 && !s.anchor)
    const first = opensAt.length ? opensAt : scene.shapes.slice(0, 1)
    for (const shape of first) painter.paint(sceneIndex, shape, scene.shapes)

    // Drawing starts immediately on an estimated clock rather than waiting for
    // the voiceover. TTS takes several seconds — longer when six scenes' worth
    // of audio and images are in flight — and gating the board on it left the
    // canvas showing a single shape until the audio landed.
    let duration = estimateNarrationSeconds(scene.narration)
    let schedule = oneAtATime(
      finishEachBox(
        holdInsideParents(scene.shapes.map((shape) => ({ shape, time: shape.at * duration }))),
        duration
      ),
      duration
    )
    // How long to stay on the finished board after the voice stops, so what
    // was drawn last can actually be read. Usually zero.
    let hold = sceneHold(schedule, duration)

    void narrator.get(scene.narration).then((narration) => {
      if (cancelled) return

      audio = narration.audio
      audioRef.current = audio
      duration = narration.duration

      // Re-time against the real clip: anchored shapes now land on their words.
      schedule = oneAtATime(
        finishEachBox(
          holdInsideParents(
            scene.shapes.map((shape) => {
              const anchored = shape.anchor ? narration.timeOf(shape.anchor) : null
              return { shape, time: anchored ?? shape.at * narration.duration }
            })
          ),
          narration.duration
        ),
        narration.duration
      )
      hold = sceneHold(schedule, narration.duration)

      const next = lessonRef.current?.scenes[sceneIndex + 1]
      if (next) narrator.prefetch(next.narration)

      if (audio) {
        // From the top, so the learner hears the whole scene. Anything already
        // drawn during the silent lead simply stays put.
        audio.currentTime = 0
        if (playingRef.current) void audio.play().catch(() => setIsPlaying(false))
      }
    })

    void (async () => {
      let elapsed = 0
      let held = 0
      let last = performance.now()
      let advanced = false

      const tick = (now: number) => {
        if (cancelled) return

        const delta = (now - last) / 1000
        last = now
        if (playingRef.current) elapsed += delta

        const seconds = audio ? audio.currentTime : elapsed
        const fraction = Math.min(1, seconds / Math.max(0.1, duration))

        for (const entry of schedule) {
          if (entry.time <= seconds) painter.paint(sceneIndex, entry.shape, scene.shapes)
        }

        // The clip has finished, but the scene has not: `audio.currentTime`
        // stops at the end of the audio, so the hold is timed on its own clock.
        const spoken = audio ? audio.ended || fraction >= 1 : fraction >= 1
        if (spoken && playingRef.current) held += delta

        const ended = spoken && held >= hold
        if (ended && !advanced) {
          advanced = true
          const total = lessonRef.current?.scenes.length ?? 0

          if (sceneIndex + 1 < total) {
            setSceneIndex(sceneIndex + 1)
          } else if (streamingRef.current) {
            // Playback has outrun the model. Hold here; `addScene` resumes us
            // the moment the next scene lands.
            waitingRef.current = true
          } else if (planRef.current && planRef.current.next < planRef.current.total) {
            // The script goes on, but the board for it has not been drawn — and
            // drawing it costs money. So stop at the edge and wait to be asked.
            // Play or next carries on from here.
            setIsPlaying(false)
            setAtEdge(true)
          } else {
            setIsPlaying(false)
            setFinished(true)
          }
          return
        }

        frame = requestAnimationFrame(tick)
      }

      frame = requestAnimationFrame(tick)
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      audio?.pause()
      if (audioRef.current === audio) audioRef.current = null
    }
  }, [phase, sceneIndex, sceneId, painterReady])

  const goToScene = useCallback(
    (index: number) => {
      const painter = painterRef.current
      if (!lesson || !painter) return

      // Asking for a scene past the end is what draws it: the rest of the
      // script is written, it just hasn't been put on the board yet.
      if (index >= lesson.scenes.length) {
        void carryOn()
        return
      }

      const target = Math.max(0, Math.min(lesson.scenes.length - 1, index))

      // Skipping forward shouldn't leave holes in the board: fill in every
      // earlier scene at once, without the fade-in choreography.
      for (let i = 0; i < target; i++) {
        for (const shape of lesson.scenes[i].shapes) {
          painter.paint(i, shape, lesson.scenes[i].shapes, false)
        }
      }

      waitingRef.current = false
      setFinished(false)
      setAtEdge(false)
      setSceneIndex(target)
    },
    [lesson, carryOn]
  )

  /**
   * Answers a question mid-lesson.
   *
   * The answer is inserted as a scene directly after the one playing, so the
   * board pans to fresh space, draws the answer, and then carries on into the
   * scene that was coming next. Inserting after the current index is safe:
   * every later scene is unpainted, so renumbering them costs nothing.
   */
  async function ask(asked?: string) {
    const text = (asked ?? question).trim()
    const current = lessonRef.current
    if (!text || !current || asking) return

    setAsking(true)
    setIsPlaying(false)

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: text,
          title: current.title,
          current: current.scenes[sceneIndex]?.narration ?? '',
          engine,
          provider: 'openai',
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error ?? `Request failed (${response.status})`)

      const scenes = [...current.scenes]
      scenes.splice(sceneIndex + 1, 0, data.scene)
      const next = { ...current, scenes }
      lessonRef.current = next

      setLesson(next)
      setQuestion('')
      setFinished(false)
      setSceneIndex(sceneIndex + 1)
      setIsPlaying(true)
    } catch (cause) {
      console.error('[ask]', cause)
      setIsPlaying(true)
    } finally {
      setAsking(false)
    }
  }

  function restart() {
    painterRef.current?.reset()
    waitingRef.current = false
    setFinished(false)
    setAtEdge(false)
    setSceneIndex(0)
    setIsPlaying(true)
  }

  function newLesson() {
    // Bumping the run id makes any in-flight stream stop writing into state.
    runIdRef.current++
    streamingRef.current = false
    waitingRef.current = false
    lessonRef.current = null
    planRef.current = null
    setPlan(null)
    setError(null)
    setAtEdge(false)

    setIsPlaying(false)
    setPhase('idle')
    setLesson(null)
    setFinished(false)
    painterRef.current?.reset()
    narratorRef.current?.dispose()
    narratorRef.current = null
  }

  /**
   * The controls, published upward for the composer to draw.
   *
   * Built from primitives only, with the actions reading through a ref that is
   * refreshed after each render. The obvious version — putting `goToScene` and
   * friends in the dependency list — rebuilt this object on every render, and
   * since publishing it sets state in the parent, that was an infinite loop:
   * publish, re-render, new object, publish. What the parent needs to hear
   * about is a change in what the controls *can do*, and that is all
   * primitives.
   */
  const scenes = lesson?.scenes.length ?? 0
  const progress = plan
    ? drawing
      ? `drawing ${plan.next + 1} of ${plan.total}…`
      : `${plan.next} of ${plan.total} drawn`
    : null

  const actions = useRef({ goToScene, carryOn, restart, ask, newLesson, finished, atEdge, sceneIndex })
  useEffect(() => {
    actions.current = { goToScene, carryOn, restart, ask, newLesson, finished, atEdge, sceneIndex }
  })

  const transport = useMemo<LessonTransport | null>(() => {
    if (phase !== 'board') return null

    return {
      playing: isPlaying,
      finished,
      atEdge,
      drawing,
      asking,
      progress,
      hasPrev: sceneIndex > 0,
      hasNext: !drawing && scenes > 0 && (sceneIndex < scenes - 1 || hasMore),
      toggle: () => {
        const now = actions.current
        if (now.finished) now.restart()
        else if (now.atEdge) void now.carryOn()
        else setIsPlaying((value) => !value)
      },
      prev: () => actions.current.goToScene(actions.current.sceneIndex - 1),
      next: () => actions.current.goToScene(actions.current.sceneIndex + 1),
      ask: (question: string) => void actions.current.ask(question),
      reset: () => actions.current.newLesson(),
    }
  }, [phase, isPlaying, finished, atEdge, drawing, asking, progress, sceneIndex, scenes, hasMore])

  useEffect(() => {
    onTransport?.(transport)
  }, [transport, onTransport])

  if (phase !== 'board') {
    // Embedded, the panel shows the workspace's own welcome until a lesson is
    // asked for; the loading line lives on the composer.
    if (embedded) return null

    return (
      <TopicScreen
        topic={topic}
        setTopic={setTopic}
        onSubmit={generate}
        script={script}
        setScript={setScript}
        busy={phase === 'generating'}
        pendingTitle={pendingTitle}
        error={error}
      />
    )
  }

  return (
    <div className={embedded ? 'absolute inset-0 bg-white' : 'fixed inset-0 bg-white'}>
      <Board ref={takeBoard} />

      {/* Nothing floats over the board any more. The controls live on the
          composer, where every other instruction to this app is given. */}
    </div>
  )
}


/** Its own component so each generation remounts it and restarts at line one. */
function LoadingLine() {
  const [line, setLine] = useState(0)

  useEffect(() => {
    const timer = setInterval(
      () => setLine((value) => (value + 1) % LOADING_LINES.length),
      4200
    )
    return () => clearInterval(timer)
  }, [])

  return <>{LOADING_LINES[line]}</>
}

function TopicScreen({
  topic,
  setTopic,
  onSubmit,
  script,
  setScript,
  busy,
  pendingTitle,
  error,
}: {
  topic: string
  setTopic: (value: string) => void
  onSubmit: (topic: string, script?: string) => void
  script: string
  setScript: (value: string) => void
  busy: boolean
  pendingTitle: string | null
  error: string | null
}) {
  const scenes = script.trim() ? parseScript(script).length : 0

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-6 py-16">
      <div className="w-full max-w-2xl">
        <div className="mb-5">
          <Logo height={30} href={null} />
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
          What should I teach you?
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-500">
          Name a topic and I&rsquo;ll work through it at the whiteboard — drawing as I talk,
          the way a good teacher does. Or give me a script you have already written, and I
          will draw the board for it and leave your words alone.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(topic, script)
          }}
          className="mt-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              disabled={busy}
              autoFocus
              maxLength={500}
              placeholder="How does a transformer pay attention?"
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-[15px] text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || (!topic.trim() && !script.trim())}
              className="shrink-0 rounded-xl bg-zinc-900 px-6 py-3.5 text-[15px] font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Preparing…' : scenes ? `Draw ${scenes} scenes` : 'Teach me'}
            </button>
          </div>

          {/* A script, if there is one. Scene count comes from the script, so a
              fourteen-block script is a fourteen-scene lesson. */}
          <details className="mt-3 group" open={Boolean(script.trim())}>
            <summary className="cursor-pointer select-none text-sm text-zinc-500 transition hover:text-zinc-700">
              {scenes
                ? `Script — ${scenes} scene${scenes === 1 ? '' : 's'}, drawn as written`
                : 'Have a script already? Paste it instead'}
            </summary>
            <textarea
              value={script}
              onChange={(event) => setScript(event.target.value)}
              disabled={busy}
              rows={8}
              placeholder={
                'Paste the whole script. One scene per block — blank lines, headed sections\nor blockquotes all work, and there is no limit on how many.\n\nYour words are copied through exactly; only the drawing is invented.'
              }
              className="mt-2 w-full resize-y rounded-xl border border-zinc-200 bg-white px-4 py-3 font-mono text-[13px] leading-relaxed text-zinc-800 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 disabled:opacity-60"
            />
            {scenes > 0 && (
              <p className="mt-1.5 text-xs text-zinc-500">
                The topic box becomes optional — it only names the lesson.
              </p>
            )}
          </details>
        </form>

        {busy ? (
          <div className="mt-6 flex items-center gap-3 text-sm text-zinc-500">
            <span className="size-2 animate-pulse rounded-full bg-zinc-900" />
            {pendingTitle ? (
              <span>
                <span className="text-zinc-400">Preparing</span>{' '}
                <span className="font-medium text-zinc-700">{pendingTitle}</span>
              </span>
            ) : (
              <LoadingLine />
            )}
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setTopic(suggestion)
                  onSubmit(suggestion)
                }}
                className="rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-[13px] text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
