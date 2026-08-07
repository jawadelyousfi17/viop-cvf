'use client'

import { VOICES, type VoiceId } from '@/lib/voices'

/**
 * The narration voice, in the app's own chrome.
 *
 * Shared by every engine that speaks. It was written inside the whiteboard
 * studio and lifted out the first time a second player needed it — two copies
 * of a control is two places for the voice list to drift.
 */
export function VoicePicker({
  value,
  onChange,
  disabled,
}: {
  value: VoiceId
  onChange: (id: VoiceId) => void
  disabled?: boolean
}) {
  return (
    <label className="relative flex items-center">
      <span className="sr-only">Narration voice</span>
      <svg
        viewBox="0 0 20 20"
        aria-hidden
        className="pointer-events-none absolute left-2.5 size-4 text-zinc-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <path d="M10 3.5v13M6.5 7v6M3 9v2M13.5 7v6M17 9v2" />
      </svg>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as VoiceId)}
        title={disabled ? 'No voice key configured' : 'Narration voice'}
        className="cursor-pointer appearance-none rounded-full border border-black/10 bg-white py-1.5 pl-8 pr-7 text-sm font-medium text-zinc-700 outline-none transition hover:border-black/20 hover:bg-zinc-50 focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {VOICES.map((voice) => (
          <option key={voice.id} value={voice.id}>
            {voice.name}
          </option>
        ))}
      </select>
      {/* Without a visible chevron the select reads as a static label. */}
      <svg
        viewBox="0 0 20 20"
        aria-hidden
        className="pointer-events-none absolute right-2.5 size-3.5 text-zinc-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5 8 5 5 5-5" />
      </svg>
    </label>
  )
}
