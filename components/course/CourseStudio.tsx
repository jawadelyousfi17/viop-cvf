'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_VOICE_ID, type VoiceId } from '@/lib/voices'
import type { Course, CourseAction, CourseStep } from '@/lib/course'
import { Narrator } from '../narrator'
import { VoicePicker } from '../VoicePicker'
import { Editor } from './Editor'
import { Preview, type RunResult } from './Preview'
import { clearBoard, drawItem } from './teacher-board'
import type { BoardItem } from '@/lib/course-board'
import type { Editor as TldrawEditor, TLShapeId } from 'tldraw'
import './course.css'

// tldraw is large and browser-only, and the lesson is readable before the
// board has loaded — so it arrives on its own.
const Sketchpad = dynamic(() => import('./Sketchpad'), {
  ssr: false,
  loading: () => <div className="sketch-loading">Getting the pens…</div>,
})

/**
 * The course player.
 *
 * One idea holds the whole file together: **the clock is the only thing that
 * moves the lesson.** A frame asks the audio where it is, works out which
 * sentence that is, and fires whatever was pinned to it. There is no queue, no
 * scheduler and no per-action timer, which is why pausing, scrubbing and
 * replaying a step need no bookkeeping of their own — the same rule the demo in
 * `components/demos/` arrived at, and the reason nothing can drift out of step
 * with the voice.
 *
 * The one thing that is *not* on the clock is a gate. A quiz or a task suspends
 * the lesson at the end of its step and waits for a person, because a lesson
 * that carries on talking over the exercise it just set is not interactive, it
 * is a video.
 */

/** A sentence, once it has a place on the clock. */
interface Cue {
  beat: number
  start: number
}

/** Reading pace, for timing a step before its recording has arrived. */
const WORDS_PER_SECOND = 2.6

/** How long each line of written code holds the floor before the next lands. */
const LINE_MS = 190

const gateKey = (step: number, line: number) => `${step}:${line}`

/** The gates in a step: the things that wait for a person. */
const gatesOf = (step: CourseStep) =>
  step.actions.filter((action) => action.kind === 'quiz' || action.kind === 'task')

/** The first words of a sentence, for finding it in the recording. */
const opening = (text: string) =>
  text
    .replace(/\[[^\]]*\]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(' ')

export default function CourseStudio({ slug }: { slug: string }) {
  const [course, setCourse] = useState<Course | null>(null)
  const [voiced, setVoiced] = useState<boolean[]>([])
  const [problem, setProblem] = useState<string | null>(null)

  const [stepIndex, setStepIndex] = useState(0)
  const [beat, setBeat] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  /** The step has finished speaking but something is still waiting for you. */
  const [waiting, setWaiting] = useState(false)

  const [code, setCode] = useState('')
  const [runId, setRunId] = useState(0)
  const [typing, setTyping] = useState(false)

  /** What the teacher is pointing at right now. Holds until the next point. */
  const [point, setPoint] = useState<CourseAction | null>(null)

  const [gates, setGates] = useState<Record<string, boolean>>({})
  const [chosen, setChosen] = useState<Record<string, number>>({})
  const [taskNote, setTaskNote] = useState<string | null>(null)

  const [voiceId, setVoiceId] = useState<VoiceId>(DEFAULT_VOICE_ID)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  const step = course?.steps[stepIndex] ?? null

  // ---------------------------------------------------------------- loading

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/course?slug=${encodeURIComponent(slug)}&voice=${voiceId}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) {
          setProblem(data.error)
          return
        }
        setCourse(data as Course)
        setVoiced(data.voiced ?? [])
        // The first step's starting code, if it has one. Applied here for the
        // same reason `goTo` applies it: arriving is an event, not a render.
        const seed = (data as Course).steps[0]?.actions.find((a) => a.kind === 'seed')
        if (seed?.code) setCode(seed.code)
        const errors = (data.problems ?? []).filter(
          (p: { severity: string }) => p.severity === 'error'
        )
        // Reported rather than swallowed. A lesson with a bad beat number still
        // plays; it just plays wrong, and silently wrong is the failure this
        // whole codebase is built to avoid.
        if (errors.length) {
          setProblem(
            `${errors.length} problem${errors.length > 1 ? 's' : ''} in the script — ` +
              errors.map((p: { message: string }) => p.message).join('; ')
          )
        }
      })
      .catch(() => !cancelled && setProblem('Could not load the lesson.'))
    return () => {
      cancelled = true
    }
  }, [slug, voiceId])

  // ------------------------------------------------------------------ clock

  const narratorRef = useRef<Narrator | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const clockRef = useRef(0)
  const cuesRef = useRef<Cue[]>([])
  const playingRef = useRef(false)
  const firedRef = useRef<Set<number>>(new Set())
  const actRef = useRef<(action: CourseAction) => void>(() => {})

  /**
   * The whiteboard, and what the teacher has put on it so far.
   *
   * `named` maps a box's id to the tldraw shape it became, so a `link` written
   * three beats later can find both its ends. Both are reset per section, which
   * is also when the teacher's own shapes are wiped — never the learner's.
   */
  const boardRef = useRef<TldrawEditor | null>(null)
  const itemsRef = useRef<BoardItem[]>([])
  const paintedRef = useRef<Set<number>>(new Set())
  const namedRef = useRef<Map<string, TLShapeId>>(new Map())

  /**
   * What the clock loop needs to know but must not depend on.
   *
   * Every one of these is written in an effect rather than during render, and
   * read from the animation frame. Making them dependencies instead would
   * rebuild the loop — and rebuilding the loop restarts the step's audio, so
   * answering a quiz would send the teacher back to the top of the paragraph.
   */
  const completeRef = useRef(false)
  const beatRef = useRef(0)

  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  useEffect(() => {
    beatRef.current = beat
  }, [beat])

  useEffect(() => {
    completeRef.current = step
      ? gatesOf(step).every((action) => gates[gateKey(step.n, action.line)])
      : true
  }, [step, gates])

  // A new section is a clean board. Done here rather than in `goTo` so it also
  // covers arriving at the first section, and so it re-runs if the board mounts
  // after the lesson has already started.
  useEffect(() => {
    itemsRef.current = step?.actions.find((a) => a.kind === 'draw')?.board ?? []
    paintedRef.current = new Set()
    namedRef.current = new Map()
    if (boardRef.current) clearBoard(boardRef.current, itemsRef.current.length > 0)
  }, [step])

  useEffect(() => {
    narratorRef.current?.setVoice(voiceId)
  }, [voiceId])

  useEffect(() => () => narratorRef.current?.dispose(), [])

  useEffect(() => {
    if (!step || !playing) return

    narratorRef.current ??= new Narrator(voiceId)
    const narrator = narratorRef.current
    if (!step.narration.trim()) return

    let cancelled = false
    let frame = 0
    let audio: HTMLAudioElement | null = null

    // Estimated first, so the lesson moves before the audio has landed.
    let cues: Cue[] = []
    let at = 0
    for (const [i, sentence] of step.beats.entries()) {
      cues.push({ beat: i + 1, start: at })
      at += Math.max(1.4, sentence.shown.split(/\s+/).filter(Boolean).length / WORDS_PER_SECOND + 0.35)
    }
    cuesRef.current = cues
    let duration = at

    void narrator.get(stepIndex, step.narration).then((spoken) => {
      if (cancelled) return
      audio = spoken.audio
      audioRef.current = audio
      duration = spoken.duration

      // Re-timed against the recording: each sentence starts where it is
      // actually said. One the aligner cannot find keeps its estimate.
      cues = cues.map((cue) => ({
        ...cue,
        start: spoken.timeOf(opening(step.beats[cue.beat - 1].text)) ?? cue.start,
      }))
      for (let i = 1; i < cues.length; i++) {
        if (cues[i].start < cues[i - 1].start) cues[i].start = cues[i - 1].start
      }
      cuesRef.current = cues

      const next = course?.steps[stepIndex + 1]
      if (next?.narration) narrator.prefetch(stepIndex + 1, next.narration)

      if (audio && playingRef.current) {
        audio.currentTime = clockRef.current
        void audio.play().catch(() => setPlaying(false))
      }
    })

    let last = performance.now()
    const tick = (now: number) => {
      if (cancelled) return
      const delta = (now - last) / 1000
      last = now
      if (playingRef.current) clockRef.current += delta

      const seconds = audio && !audio.paused ? audio.currentTime : clockRef.current

      let current = 0
      for (const cue of cuesRef.current) if (seconds >= cue.start) current = cue.beat
      if (current) {
        setBeat(current)
        for (const action of step.actions) {
          if (action.beat > current || firedRef.current.has(action.line)) continue
          firedRef.current.add(action.line)
          actRef.current(action)
        }

        // The diagram assembles itself part by part. Kept in the clock loop
        // rather than in an effect because it is the same question the rest of
        // the loop asks — what is true at beat n — and drawing is an effect on
        // an external system, not a render.
        const board = boardRef.current
        if (board) {
          for (const item of itemsRef.current) {
            if (item.beat > current || paintedRef.current.has(item.line)) continue
            paintedRef.current.add(item.line)
            try {
              drawItem(board, item, namedRef.current)
            } catch {
              // One shape that tldraw refuses costs one shape. A lesson does
              // not stop because an arrow could not be bound.
            }
          }
        }
      }

      // The step is spoken. Whether it is *finished* is a different question.
      if (seconds >= duration - 0.05 && (!audio || audio.ended || audio.paused)) {
        if (completeRef.current) {
          advance()
          return
        }
        setWaiting(true)
      }

      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      audio?.pause()
    }
    // `advance` is stable; `gates` deliberately absent — answering a quiz must
    // not restart the step's audio. The clock reads it through completeRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, stepIndex, playing, voiceId])

  // Pausing has to reach the element the clock is reading from.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) void audio.play().catch(() => {})
    else audio.pause()
  }, [playing])

  // ---------------------------------------------------------- the keyboard

  const run = useCallback(() => setRunId((id) => id + 1), [])
  const runRef = useRef(run)

  /** The teacher's hand on the keyboard. Cleared whenever the step changes. */
  const typeTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTyping = useCallback(() => {
    if (typeTimer.current) clearInterval(typeTimer.current)
    typeTimer.current = null
    setTyping(false)
  }, [])

  /**
   * Writing, rather than pasting — a line at a time.
   *
   * Character-by-character was the obvious first guess and the wrong one. A
   * line of code is one thought, and watching it assemble letter by letter puts
   * the reader's attention on the spelling of a keyword at exactly the moment
   * the narration is explaining what the line *means*. Whole lines arriving in
   * order is how code appears on a real board, and it leaves a beat between
   * each one for the sentence to catch up.
   *
   * This is the one animation in the player that is not a function of the
   * clock, because it is not synchronising with the voice — it is *acting*.
   */
  const type = useCallback(
    (target: string, andRun: boolean) => {
      if (typeTimer.current) clearInterval(typeTimer.current)
      setTyping(true)
      setCode('')

      const rows = target.split('\n')
      let at = 0
      typeTimer.current = setInterval(() => {
        at += 1
        // A blank line is spacing, not a step in the explanation — pausing on
        // one is a pause on nothing, and reads as the teacher losing their
        // thread. Carry straight on to the next line with something on it.
        while (at < rows.length && !rows[at - 1].trim()) at += 1

        setCode(rows.slice(0, at).join('\n'))
        if (at < rows.length) return
        stopTyping()
        if (andRun) runRef.current()
      }, LINE_MS)
    },
    [stopTyping]
  )

  useEffect(() => {
    runRef.current = run
  }, [run])

  useEffect(() => () => stopTyping(), [stopTyping])

  /** Everything pinned to a beat, fired the moment the clock reaches it. */
  useEffect(() => {
    actRef.current = (action: CourseAction) => {
      if (action.kind === 'write' && action.code) {
        // A point made against the old code would be pointing at line numbers
        // that are about to move underneath it.
        setPoint(null)
        type(action.code, !!action.run)
      }
      if (action.kind === 'point') setPoint(action)
      // Quizzes and tasks need nothing here: they are on screen whenever the
      // clock has passed their beat, which makes them survive a replay free.
    }
  }, [type])

  // --------------------------------------------------------------- movement

  /**
   * Arriving at a step.
   *
   * `seed` is applied here rather than from an effect watching the step,
   * because seeding is something that happens when you *arrive* — and an
   * effect would also fire on a re-render, quietly throwing away work the
   * learner had done in the editor. A step with no seed keeps what is already
   * there, which is what lets step five ask you to add to what step four wrote.
   */
  const goTo = useCallback(
    (index: number) => {
      stopTyping()
      firedRef.current = new Set()
      clockRef.current = 0
      cuesRef.current = []
      audioRef.current?.pause()
      audioRef.current = null
      setBeat(0)
      setWaiting(false)
      setTaskNote(null)
      setPoint(null)
      setStepIndex(index)

      const seed = course?.steps[index]?.actions.find((action) => action.kind === 'seed')
      if (seed?.code) setCode(seed.code)
    },
    [course, stopTyping]
  )

  // Where the lesson is, readable from the clock loop without making the loop
  // depend on it — a dependency there would restart the audio on every beat.
  const stepIndexRef = useRef(0)
  useEffect(() => {
    stepIndexRef.current = stepIndex
  }, [stepIndex])

  const advance = useCallback(() => {
    const last = (course?.steps.length ?? 1) - 1
    if (stepIndexRef.current >= last) {
      setPlaying(false)
      return
    }
    goTo(stepIndexRef.current + 1)
  }, [course, goTo])

  // A gate answered after the voice has stopped releases the lesson.
  useEffect(() => {
    if (!waiting || !step) return
    if (gatesOf(step).every((action) => gates[gateKey(step.n, action.line)])) advance()
  }, [waiting, gates, step, advance])

  const [output, setOutput] = useState<string[]>([])

  const onResult = useCallback(
    (result: RunResult) => {
      setOutput(result.output)
      if (!step) return
      const text = result.output.join('\n')

      for (const action of step.actions) {
        if (action.kind !== 'task') continue
        const key = gateKey(step.n, action.line)
        if (gates[key]) continue

        if (result.failed) {
          setTaskNote('That threw an error — read the red line and try again.')
          continue
        }
        const passed = action.expect ? new RegExp(action.expect).test(text) : true
        if (passed) {
          setGates((current) => ({ ...current, [key]: true }))
          setTaskNote(null)
        } else {
          setTaskNote('It ran, but that is not the output I am looking for yet.')
        }
      }
    },
    [step, gates]
  )

  // ------------------------------------------------------------------- ask

  const ask = useCallback(async () => {
    const asked = question.trim()
    if (!asked || !step || asking) return
    setAsking(true)
    setAnswer('')
    try {
      const response = await fetch('/api/course', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: asked,
          step: `${step.title}\n${step.beats.map((b) => b.shown).join(' ')}`,
          code,
        }),
      })
      if (!response.ok || !response.body) {
        setAnswer('I could not answer that just now.')
        return
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let text = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setAnswer(text)
      }
    } catch {
      setAnswer('I could not answer that just now.')
    } finally {
      setAsking(false)
      setQuestion('')
    }
  }, [question, step, code, asking])

  // ---------------------------------------------------------------- render

  // Only the things that wait for a person. Named positively rather than as a
  // list of exclusions, so a new action kind cannot accidentally render itself
  // in the teacher's column as a malformed quiz.
  const visible = useMemo(
    () =>
      step
        ? step.actions.filter(
            (a) => (a.kind === 'quiz' || a.kind === 'task') && a.beat <= beat
          )
        : [],
    [step, beat]
  )

  if (problem && !course) {
    return <main className="course-error">{problem}</main>
  }
  if (!course || !step) {
    return <main className="course-error">Opening the lesson…</main>
  }

  const unvoiced = voiced.filter((has) => !has).length

  return (
    <main className="course">
      <header className="course-bar">
        <div className="course-id">
          <h1>{course.title}</h1>
          <p>{course.takeaway}</p>
        </div>

        <div className="course-steps" role="list" aria-label="Steps">
          {course.steps.map((s, i) => (
            <button
              key={s.n}
              role="listitem"
              className={`pip${i === stepIndex ? ' now' : ''}${i < stepIndex ? ' done' : ''}`}
              title={`${s.n}. ${s.title}`}
              onClick={() => goTo(i)}
            >
              <span className="sr-only">{s.title}</span>
            </button>
          ))}
        </div>

        <div className="course-controls">
          <VoicePicker value={voiceId} onChange={setVoiceId} disabled={playing} />
          <button
            className="primary"
            onClick={() => {
              setStarted(true)
              setPlaying((on) => !on)
            }}
          >
            {!started ? 'Start' : playing ? 'Pause' : 'Resume'}
          </button>
        </div>
      </header>

      {problem ? <div className="course-warning">{problem}</div> : null}
      {!started && unvoiced > 0 ? (
        <div className="course-warning">
          {unvoiced} of {course.steps.length} steps are not recorded yet and will be
          synthesised as you reach them. Run{' '}
          <code>node scripts/course-voice.mjs {slug}</code> to record them once instead.
        </div>
      ) : null}

      <div className="course-body">
        {/* ---------------------------------------------------- the teacher */}
        <section className="teacher" aria-label="Lesson">
          <h2 className="teacher-step">
            <span>{step.n}</span> {step.title}
          </h2>

          <div className="script">
            {step.beats.map((line, i) => (
              <p
                key={i}
                className={
                  i + 1 === beat ? 'said now' : i + 1 < beat ? 'said' : 'said ahead'
                }
              >
                {line.shown}
              </p>
            ))}
          </div>

          {visible.map((action) =>
            action.kind === 'quiz' ? (
              <Quiz
                key={action.line}
                action={action}
                chosen={chosen[gateKey(step.n, action.line)]}
                onChoose={(index) => {
                  const key = gateKey(step.n, action.line)
                  setChosen((current) => ({ ...current, [key]: index }))
                  if (action.options?.[index]?.correct) {
                    setGates((current) => ({ ...current, [key]: true }))
                  }
                }}
              />
            ) : (
              <div
                key={action.line}
                className={`gate task${gates[gateKey(step.n, action.line)] ? ' passed' : ''}`}
              >
                <h3>Your turn</h3>
                <p>{action.prompt}</p>
                {gates[gateKey(step.n, action.line)] ? (
                  <p className="verdict right">That is it. Nicely done.</p>
                ) : (
                  <>
                    <button className="primary" onClick={run}>
                      Run it
                    </button>
                    {taskNote ? <p className="verdict wrong">{taskNote}</p> : null}
                  </>
                )}
              </div>
            )
          )}

          {waiting ? (
            <p className="holding">Waiting on you — finish the bit above and we will go on.</p>
          ) : null}

          <div className="ask">
            <label htmlFor="ask">Ask about this bit</label>
            <div className="ask-row">
              <input
                id="ask"
                value={question}
                placeholder="Why does this not work?"
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && void ask()}
              />
              <button onClick={() => void ask()} disabled={asking || !question.trim()}>
                {asking ? '…' : 'Ask'}
              </button>
            </div>
            {answer !== null ? <p className="answer">{answer || '…'}</p> : null}
          </div>
        </section>

        {/* ------------------------------------------------- code and output */}
        <section className="work" aria-label="Code">
          <div className="pane-bar">
            <span className="pane-name">script.js</span>
            {typing ? <span className="pane-note">writing…</span> : null}
            <button className="run" onClick={run} disabled={typing}>
              Run
            </button>
          </div>

          <Editor
            value={code}
            onChange={setCode}
            readOnly={typing}
            onRun={run}
            point={
              point?.target === 'code' && point.lines
                ? { lines: point.lines, label: point.label }
                : null
            }
          />
          <Preview
            code={code}
            runId={runId}
            onResult={onResult}
            marked={point?.target === 'output'}
          />
          <span className="sr-only" aria-live="polite">
            {output.join('. ')}
          </span>
        </section>

        {/* ------------------------------------------------- the sketchpad */}
        <section className="sketch" aria-label="Your whiteboard">
          <div className="pane-bar">
            <span className="pane-name">Your whiteboard</span>
            <span className="pane-note">yours to scribble on</span>
          </div>
          <div className="sketch-board">
            <Sketchpad
              onEditor={(editor) => {
                boardRef.current = editor
                // The board can mount after a section has already begun, so it
                // catches up rather than staying blank until the next one.
                clearBoard(editor, itemsRef.current.length > 0)
                for (const item of itemsRef.current) {
                  if (item.beat > beatRef.current) continue
                  paintedRef.current.add(item.line)
                  try {
                    drawItem(editor, item, namedRef.current)
                  } catch {}
                }
              }}
            />
          </div>
        </section>
      </div>
    </main>
  )
}

function Quiz({
  action,
  chosen,
  onChoose,
}: {
  action: CourseAction
  chosen: number | undefined
  onChoose: (index: number) => void
}) {
  const answered = chosen !== undefined
  const right = answered && !!action.options?.[chosen]?.correct

  return (
    <div className={`gate quiz${right ? ' passed' : ''}`}>
      <h3>Quick check</h3>
      <p>{action.question}</p>
      <ul>
        {action.options?.map((option, index) => {
          const picked = chosen === index
          const mark = !answered ? '' : option.correct ? ' right' : picked ? ' wrong' : ' faded'
          return (
            <li key={index}>
              <button
                className={`option${mark}`}
                disabled={right}
                onClick={() => onChoose(index)}
              >
                {option.text}
              </button>
            </li>
          )
        })}
      </ul>
      {answered ? (
        <p className={`verdict ${right ? 'right' : 'wrong'}`}>
          {right ? '' : 'Not quite. '}
          {action.because}
        </p>
      ) : null}
    </div>
  )
}
