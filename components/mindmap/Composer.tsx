'use client'

import { useEffect, useRef, useState } from 'react'

import type { LessonTransport } from '../whiteboard/WhiteboardStudio'
import { IconArrowUp, IconBoard, IconChevron, IconMap, IconMic, IconSigma } from './icons'

/**
 * The one input, floating over the panel.
 *
 * It stays put whether the panel is empty or holds a map, because asking for
 * the next map is the same gesture either way — and a board that hides the
 * only way to start again makes "New map" a trip back to a different screen.
 *
 * One field and nothing else. The outline syntax still exists — /api/mindmap
 * takes it, and an exported map is written in it — but it is not something to
 * put in front of someone whose whole job here is to name a topic.
 */
export type Mode = 'map' | 'lesson' | 'math'

export type Speed = 'fast' | 'thinking'

/** What each setting is called in the interface. */
const SPEED_LABELS: Record<Speed, string> = { fast: 'Fast', thinking: 'Thinking' }

/** What each setting actually calls. */
export const SPEED_MODELS: Record<Speed, string> = {
  fast: 'gpt-5.6-luna',
  thinking: 'gpt-5.6-terra',
}

export function Composer({
  mode = 'lesson',
  onMode,
  centred = false,
  transport = null,
  speed,
  onSpeed,
  topic,
  busy,
  spent = null,
  onFund,
  onTopic,
  onSubmit,
}: {
  /** Which side the input is aimed at — it changes what it promises. */
  mode?: Mode
  onMode: (mode: Mode) => void
  /**
   * The playing lesson's controls, when there is one.
   *
   * They live here rather than in a pill over the board: this is where every
   * other instruction to this app is given, and controls that move depending
   * on which half of the product you are in are controls you have to hunt for.
   */
  transport?: LessonTransport | null
  /**
   * Nothing on the board yet.
   *
   * With work on screen the input belongs at the foot, out of the way of it.
   * With an empty panel there is nothing to be out of the way of, and an input
   * pinned to the bottom of a blank page looks like a footer rather than the
   * thing you are meant to type in.
   */
  centred?: boolean
  /**
   * Which model answers.
   *
   * Fast is gpt-5.6-luna and thinking is gpt-5.6-terra, and the difference is
   * worth a switch rather than a setting: a map of something you half know
   * wants an answer now, and a map of something you don't wants the better
   * one. Both sides of the app read the same choice.
   */
  speed: Speed
  onSpeed: (speed: Speed) => void
  topic: string
  busy: boolean
  /**
   * Set when this mode's allowance is gone.
   *
   * Per mode, not per account: maps and lessons are counted separately and
   * running out of one says nothing about the other, so the box is only shut
   * for the side that is actually spent.
   */
  spent?: { limit: number; thing: string } | null
  /** Opens the ask. Shown instead of a way to pay, because there isn't one yet. */
  onFund?: () => void
  onTopic: (value: string) => void
  onSubmit: () => void
}) {
  const field = useRef<HTMLTextAreaElement | null>(null)

  /**
   * Grow to fit what has been typed, up to a few lines.
   *
   * Measured after each change rather than guessed from the character count:
   * wrapping depends on the width and the font, and the browser is the only
   * one who knows both.
   */
  useEffect(() => {
    const element = field.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(200, element.scrollHeight)}px`
  }, [topic])

  const ready = Boolean(topic.trim())

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 flex justify-center px-6 ${
        centred ? 'bottom-0 top-0 items-center' : 'bottom-0 pb-6'
      }`}
    >
      <div className="pointer-events-auto w-full max-w-[760px]">
        {/*
          Said here rather than after they have typed a topic and waited.
          Finding out you have run out by asking for something and being
          refused is a wasted minute and a worse way to be told.
        */}
        {spent && (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-[#f0d9a8] bg-[#fffaf0] px-4 py-3">
            <p className="text-[13.5px] leading-snug text-[#6b5322]">
              <span className="font-semibold">
                That&rsquo;s all {spent.limit} {spent.thing} on the free plan.
              </span>{' '}
              Paid plans aren&rsquo;t open yet — we&rsquo;re in beta and raising to get there.
              Everything you made is still here.
            </p>
            {onFund && (
              <button
                type="button"
                onClick={onFund}
                className="ml-auto flex h-8 shrink-0 items-center rounded-lg bg-gradient-to-b from-[#2f70ee] to-[#2363df] px-3.5 text-[12.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15)] transition hover:brightness-[1.06]"
              >
                Help us build it
              </button>
            )}
          </div>
        )}
        {/* Which of the two the box is asking for, directly above the box.
            It was in the rail, next to things you navigate to — but this is
            not navigation, it is what the next sentence you type will mean. */}
        <div className="mb-2 flex justify-center gap-6">
          {([
            ['lesson', 'Lesson', IconBoard],
            ['map', 'Mindmap', IconMap],
            ['math', 'Math tutor', IconSigma],
          ] as const).map(([value, label, Glyph]) => (
            <button
              key={value}
              type="button"
              onClick={() => onMode(value)}
              aria-pressed={mode === value}
              className={`flex items-center gap-2 border-b-2 pb-1.5 text-[13.5px] transition ${
                mode === value
                  ? 'border-zinc-900 font-medium text-zinc-900'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700'
              }`}
            >
              <Glyph className="size-[17px]" />
              {label}
            </button>
          ))}
        </div>

        {/* One rounded container holding the field and everything that acts on
            it — the shape every chat interface has settled on, because it says
            "this whole thing is the input" rather than scattering controls
            around the edge of the page. */}
        <div className="rounded-[26px] border border-zinc-200 bg-white px-4 pb-2.5 pt-3.5 shadow-[0_8px_30px_-12px_rgba(15,23,42,.18)] transition focus-within:border-zinc-300 focus-within:shadow-[0_10px_36px_-12px_rgba(15,23,42,.24)]">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              onSubmit()
            }}
          >
            <textarea
              ref={field}
              value={topic}
              onChange={(event) => onTopic(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends, shift-enter starts a line — what every chat box
                // does, and what fingers already expect here.
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  onSubmit()
                }
              }}
              rows={1}
              disabled={busy || Boolean(spent)}
              maxLength={400}
              placeholder={
                transport
                  ? transport.asking
                    ? 'Working it out…'
                    : 'Ask about this lesson…'
                  : mode === 'lesson'
                    ? 'Teach me anything…'
                    : mode === 'math'
                      ? 'Give me a problem, or ask me to prove something…'
                      : 'Map anything…'
              }
              className="max-h-[200px] w-full resize-none bg-transparent px-1 pb-3 text-[16px] leading-6 text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-60"
            />

            <div className="flex items-center gap-1">
              {busy && (
                <span className="ml-2 flex items-center gap-2 text-[13px] text-zinc-400">
                  <span className="size-2 animate-pulse rounded-full bg-zinc-900" />
                  {mode === 'lesson'
                    ? 'Planning the lesson…'
                    : mode === 'math'
                      ? 'Working it through…'
                      : 'Working out the branches…'}
                </span>
              )}

              {/* The lesson's own controls, when one is playing. */}
              {transport && (
                <>
                  <span className="mx-1 h-6 w-px bg-zinc-100" />
                  <Step label="Previous scene" onClick={transport.prev} disabled={!transport.hasPrev}>
                    <path d="M14 5 8 10l6 5V5Z" />
                    <path d="M6 5v10" />
                  </Step>
                  <button
                    type="button"
                    onClick={transport.toggle}
                    aria-label={
                      transport.finished
                        ? 'Replay lesson'
                        : transport.atEdge
                          ? 'Draw the next scene and carry on'
                          : transport.playing
                            ? 'Pause'
                            : 'Play'
                    }
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-800 transition hover:bg-zinc-200"
                  >
                    {transport.finished ? (
                      <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 10a6 6 0 1 1-1.8-4.3" />
                        <path d="M15 3v3h-3" />
                      </svg>
                    ) : transport.playing ? (
                      <svg viewBox="0 0 20 20" className="size-4" fill="currentColor">
                        <rect x="6" y="5" width="3" height="10" rx="1" />
                        <rect x="11" y="5" width="3" height="10" rx="1" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 20 20" className="size-4" fill="currentColor">
                        <path d="M7 4.8v10.4a.8.8 0 0 0 1.22.68l8.2-5.2a.8.8 0 0 0 0-1.36l-8.2-5.2A.8.8 0 0 0 7 4.8Z" />
                      </svg>
                    )}
                  </button>
                  <Step label="Next scene" onClick={transport.next} disabled={!transport.hasNext}>
                    <path d="M6 5l6 5-6 5V5Z" />
                    <path d="M14 5v10" />
                  </Step>

                  {transport.progress && (
                    <span className="ml-1 hidden whitespace-nowrap text-[12px] tabular-nums text-zinc-400 sm:inline">
                      {transport.progress}
                    </span>
                  )}
                </>
              )}

              {/* The one setting that changes the answer, next to the button
                  that sends it — the last thing passed before you commit. */}
              <SpeedMenu speed={speed} onSpeed={onSpeed} />

              {/* Dictation. The button is here because the shape of the
                  composer is settled and moving it later would be worse than
                  drawing it now; pressing it does nothing yet, and it says so. */}
              <button
                type="button"
                disabled
                aria-label="Voice input (not available yet)"
                title="Voice input — coming soon"
                className="grid size-9 shrink-0 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-60"
              >
                <IconMic className="size-[18px]" />
              </button>

              <button
                type="submit"
                disabled={busy || !ready || Boolean(spent)}
                aria-label={
                  transport
                    ? 'Ask'
                    : mode === 'lesson'
                      ? 'Teach this'
                      : mode === 'math'
                        ? 'Work it through'
                        : 'Draw the map'
                }
                className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-900 text-white transition enabled:hover:bg-zinc-700 disabled:bg-zinc-100 disabled:text-zinc-300"
              >
                <IconArrowUp className="size-[18px]" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/** One step-a-scene button. Two of them, mirrored, so they share a shape. */
function Step({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-30"
    >
      <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
}

/**
 * Fast or thinking, as a menu rather than a pair of buttons.
 *
 * A segmented control shouts a choice that is made once and then left alone
 * for an hour. A quiet label with a chevron says the same thing, takes the
 * room of one word, and has somewhere to put the sentence explaining what the
 * difference actually is — which two three-letter tabs never had.
 */
function SpeedMenu({ speed, onSpeed }: { speed: Speed; onSpeed: (speed: Speed) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const dismiss = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div ref={box} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 items-center gap-1 rounded-full px-2 text-[13px] text-zinc-500 transition hover:text-zinc-900"
      >
        {SPEED_LABELS[speed]}
        <IconChevron className={`size-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        // Upward: the composer sits at the foot of the panel, and a menu that
        // opened downward would open off the bottom of the window.
        <div
          role="menu"
          className="absolute bottom-10 right-0 z-20 w-64 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-1 shadow-[0_12px_40px_-12px_rgba(15,23,42,.3)]"
        >
          {(['fast', 'thinking'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={speed === option}
              onClick={() => {
                onSpeed(option)
                setOpen(false)
              }}
              className={`block w-full rounded-xl px-3 py-2.5 text-left transition ${
                speed === option ? 'bg-zinc-100' : 'hover:bg-zinc-50'
              }`}
            >
              <span className="block text-[13.5px] font-medium text-zinc-900">
                {SPEED_LABELS[option]}
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-zinc-500">
                {option === 'fast'
                  ? 'Answers sooner. Enough for most things.'
                  : 'Slower, and better on anything unfamiliar.'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
