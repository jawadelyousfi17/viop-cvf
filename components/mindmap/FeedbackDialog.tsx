'use client'

import { useState } from 'react'
import { Dialog } from '../ui/Dialog'

/**
 * How it went, on a seven-point face and in their own words.
 *
 * Seven because five cannot separate "fine" from "good", and nine is more
 * shades than anyone actually feels. An odd number keeps a true middle, which
 * is the honest answer more often than a scale built without one will admit.
 *
 * The face is required and the sentence is not. Someone who has clicked a face
 * has already told you the main thing; demanding a paragraph on top of it is
 * how you get "asdf" instead of a seven. The box is big anyway, because the
 * people who do want to write something usually have more than a line of it.
 */

const FACES = [
  { emoji: '😠', label: 'Awful' },
  { emoji: '🙁', label: 'Bad' },
  { emoji: '😕', label: 'Meh' },
  { emoji: '😐', label: 'Fine' },
  { emoji: '🙂', label: 'Good' },
  { emoji: '😄', label: 'Great' },
  { emoji: '🤩', label: 'Loved it' },
] as const

export function FeedbackDialog({
  open,
  onClose,
  from = '',
}: {
  open: boolean
  onClose: () => void
  /** Where they were when they opened it. Most of the context, for free. */
  from?: string
}) {
  const [rating, setRating] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    onClose()
    // Cleared after it has gone, so the reset is never seen mid-dismiss.
    setTimeout(() => {
      setRating(null)
      setMessage('')
      setSent(false)
      setError(null)
    }, 200)
  }

  const send = async () => {
    if (rating === null || sending) return
    setSending(true)
    setError(null)
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rating, message, from }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'That did not send.')
      }
      setSent(true)
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'That did not send.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      label="Send feedback"
      className="!w-[min(100%-1.5rem,34rem)]"
    >
      {sent ? (
        <div className="p-9 text-center">
          <p className="text-[40px] leading-none">{FACES[(rating ?? 4) - 1].emoji}</p>
          <h2 className="mt-4 text-[22px] font-semibold tracking-tight text-zinc-900">
            Thank you — that actually gets read.
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[#41506b]">
            We are small enough that one message changes what gets built next.
          </p>
          <button
            type="button"
            onClick={close}
            className="mt-6 h-11 w-full rounded-[14px] bg-zinc-900 text-[15px] font-semibold text-white transition hover:bg-zinc-700"
          >
            Back to work
          </button>
        </div>
      ) : (
        <div className="p-7">
          <h2 className="text-[22px] font-semibold tracking-tight text-zinc-900">
            How is nipsol going for you?
          </h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-[#41506b]">
            Honestly, please. We would rather hear that a board was confusing than that it
            was fine.
          </p>

          <div
            role="radiogroup"
            aria-label="How it went"
            className="mt-6 flex items-end justify-between gap-1"
          >
            {FACES.map((face, i) => {
              const value = i + 1
              const picked = rating === value
              return (
                <button
                  key={face.label}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  aria-label={face.label}
                  onClick={() => setRating(value)}
                  className={`flex flex-1 flex-col items-center gap-1.5 rounded-2xl border py-3 transition ${
                    picked
                      ? 'border-[#2f70ee] bg-[#f4f8ff]'
                      : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <span
                    className={`text-[28px] leading-none transition ${
                      picked ? 'scale-110' : 'opacity-70 grayscale'
                    }`}
                  >
                    {face.emoji}
                  </span>
                  <span
                    className={`text-[10.5px] font-medium ${
                      picked ? 'text-[#2363df]' : 'text-zinc-400'
                    }`}
                  >
                    {face.label}
                  </span>
                </button>
              )
            })}
          </div>

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={5}
            placeholder="What worked, what didn't, what you wanted it to do instead…"
            className="mt-5 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[15px] leading-relaxed text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
          />

          {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              className="h-11 rounded-[14px] px-4 text-[15px] font-medium text-zinc-500 transition hover:text-zinc-800"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={rating === null || sending}
              className="ml-auto h-11 flex-1 rounded-[14px] bg-gradient-to-b from-[#2f70ee] to-[#2363df] text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15)] transition hover:brightness-[1.06] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? 'Sending…' : 'Send feedback'}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
