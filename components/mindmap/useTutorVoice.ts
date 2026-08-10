'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Narrator } from '../narrator'
import { speakable, type MathSolution } from '@/lib/math'

/**
 * Reads a worked solution aloud, one step at a time, revealing as it goes.
 *
 * Sync here is a different problem from the lesson's. A lesson times shapes
 * against a clip using per-character alignment, because a scene draws six
 * things while one sentence is spoken. A solution has exactly one thing per
 * sentence — the step being explained — so the honest unit is the clip itself:
 * one recording per step, and the step appears when its recording starts. No
 * alignment data needed, and nothing to drift.
 *
 * Silence is a supported outcome. With no voice key the clips come back with
 * an estimated duration and no audio, and the steps still appear in time with
 * the reading speed of the words.
 */

/** What is said over each step, and which shapes belong to it. */
export interface Spoken {
  /** -1 is the problem itself, then one per step, then the answer and check. */
  group: number
  text: string
}

/**
 * The lines, in order, in a form a voice can actually read.
 *
 * Headings are not spoken — they are labels for the eye, and hearing "Apply
 * the quotient rule" before the sentence explaining it is the same thing said
 * twice. What is read is the explanation and then the line of algebra, in the
 * model's own spoken form: it knows "\\frac{dy}{dx}" is "dee y by dee x", and no
 * table of rules ever will.
 *
 * Everything goes through `speakable` regardless. The model is told not to put
 * notation in these fields and mostly does not, but one stray "x^2" reaching
 * the speech engine comes back as "x caret two" — and the cost of running a
 * sentence that was already clean through a few regexes is nothing.
 */
export function linesOf(solution: MathSolution): Spoken[] {
  const lines: Spoken[] = []
  const say = (group: number, ...parts: string[]) => {
    // Joined with a full stop only where the part does not already end in one,
    // or the voice reads "…over v squared.. let u equal…" with a stumble in it.
    const text = speakable(
      parts
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => (/[.!?]$/.test(part) ? part : `${part}.`))
        .join(' ')
    )
    if (text) lines.push({ group, text })
  }

  // Neither the title nor a step's heading is spoken. They are labels for the
  // eye — "Apply the quotient rule" read aloud before the sentence that
  // explains it is the same thing said twice, and it is the second one that
  // does the teaching.
  say(-1, solution.givenSpoken)

  for (const [i, step] of solution.steps.entries()) {
    say(i, step.say, step.spoken)
  }

  say(solution.steps.length, solution.answerSpoken, solution.answerNote, solution.check)

  return lines
}

export function useTutorVoice(
  solution: MathSolution | null,
  /** Called as each group is revealed, so the camera can follow the voice. */
  onReveal?: (group: number) => void
) {
  const [playing, setPlaying] = useState(false)
  /** Groups revealed so far. -1 shows only the problem. */
  const [revealed, setRevealed] = useState(-1)
  const [line, setLine] = useState(0)

  const narratorRef = useRef<Narrator | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Bumped on every solution and every jump, so a stale clip cannot resume. */
  const runRef = useRef(0)

  const lines = useMemo(() => (solution ? linesOf(solution) : []), [solution])

  /**
   * A new solution resets the recital.
   *
   * Adjusted during render rather than in an effect: this is state derived from
   * a prop changing, and doing it in an effect means one render showing the new
   * solution with the old solution's progress under it.
   */
  const [current, setCurrent] = useState(solution)
  if (solution !== current) {
    setCurrent(solution)
    setRevealed(-1)
    setLine(0)
    setPlaying(Boolean(solution))
  }

  const stop = useCallback(() => {
    runRef.current++
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    audioRef.current?.pause()
    audioRef.current = null
  }, [])

  // The audio behind it: a fresh narrator per solution, and every clip and
  // object URL released when this one is done with.
  useEffect(() => {
    stop()
    narratorRef.current?.dispose()
    narratorRef.current = solution ? new Narrator() : null

    return () => {
      stop()
      narratorRef.current?.dispose()
      narratorRef.current = null
    }
  }, [solution, stop])

  /**
   * Speaks one line, reveals its step, and queues the next.
   *
   * The next line is fetched while this one plays, which is what keeps the
   * gaps between steps from being the length of a TTS request.
   */
  useEffect(() => {
    const narrator = narratorRef.current
    if (!narrator || !playing || line >= lines.length) return

    const run = ++runRef.current
    const spoken = lines[line]
    let cancelled = false

    void narrator.get(spoken.text).then((narration) => {
      if (cancelled || run !== runRef.current) return

      setRevealed((shown) => Math.max(shown, spoken.group))
      onReveal?.(spoken.group)
      narrator.prefetch(lines[line + 1]?.text ?? '')

      const advance = () => {
        if (cancelled || run !== runRef.current) return
        setLine((value) => value + 1)
      }

      if (narration.audio) {
        audioRef.current = narration.audio
        narration.audio.onended = advance
        void narration.audio.play().catch(() => {
          // Autoplay refused, or no output device. The board should still move.
          timerRef.current = setTimeout(advance, narration.duration * 1000)
        })
      } else {
        timerRef.current = setTimeout(advance, narration.duration * 1000)
      }
    })

    return () => {
      cancelled = true
      audioRef.current?.pause()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [playing, line, lines, onReveal])

  const toggle = useCallback(() => {
    setPlaying((value) => {
      if (value) {
        stop()
        return false
      }
      return true
    })
  }, [stop])

  /**
   * Silence, whatever it was doing.
   *
   * `toggle` would start it talking if it happened to be stopped, which is the
   * opposite of what leaving the tutor means.
   */
  const pause = useCallback(() => {
    stop()
    setPlaying(false)
  }, [stop])

  /** Jumping shows everything up to where you jumped — you cannot un-hear it. */
  const jump = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(lines.length - 1, next))
      stop()
      setLine(target)
      setRevealed(lines[target]?.group ?? -1)
      onReveal?.(lines[target]?.group ?? -1)
      setPlaying(true)
    },
    [lines, stop, onReveal]
  )

  return {
    playing,
    finished: line >= lines.length && lines.length > 0,
    revealed,
    step: Math.min(line + 1, lines.length),
    steps: lines.length,
    hasPrev: line > 0,
    hasNext: line < lines.length - 1,
    toggle,
    pause,
    prev: () => jump(line - 1),
    next: () => jump(line + 1),
    replay: () => jump(0),
  }
}
