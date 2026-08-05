'use client'

import type { SpeechResponse } from '@/app/api/tts/route'
import { estimateNarrationSeconds } from '@/lib/lesson'

export interface Narration {
  /** null when no voice provider is configured or the request failed. */
  audio: HTMLAudioElement | null
  /** Seconds. Real audio length when we have it, an estimate otherwise. */
  duration: number
  /**
   * Start time of an anchor phrase within the narration, or null when there's
   * no alignment data or the phrase can't be found.
   */
  timeOf: (phrase: string) => number | null
}

/**
 * Fetches and caches one voiceover per scene. When narration isn't available
 * the lesson still runs, timed off a reading-speed estimate — so the app works
 * with no voice key at all.
 */
export class Narrator {
  private readonly cache = new Map<number, Promise<Narration>>()
  private readonly urls: string[] = []
  /** Flips to false after the first 501, so we stop asking. */
  private enabled = true
  /** True once any scene has come back with usable timing data. */
  private aligned = false
  private voiceId: string | undefined

  constructor(voiceId?: string) {
    this.voiceId = voiceId
  }

  /** Drops everything not yet played so later scenes use the new voice. */
  setVoice(voiceId: string) {
    if (voiceId === this.voiceId) return
    this.voiceId = voiceId
    this.cache.clear()
  }

  get(index: number, text: string): Promise<Narration> {
    const existing = this.cache.get(index)
    if (existing) return existing

    const pending = this.load(text)
    this.cache.set(index, pending)
    return pending
  }

  /** Warms the next scene's audio while the current one is still playing. */
  prefetch(index: number, text: string) {
    if (!this.cache.has(index)) void this.get(index, text).catch(() => {})
  }

  get hasVoice() {
    return this.enabled
  }

  get hasWordTiming() {
    return this.aligned
  }

  dispose() {
    for (const url of this.urls) URL.revokeObjectURL(url)
    this.urls.length = 0
    this.cache.clear()
  }

  private async load(text: string): Promise<Narration> {
    const silent: Narration = {
      audio: null,
      duration: estimateNarrationSeconds(text),
      timeOf: () => null,
    }
    if (!this.enabled) return silent

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, voiceId: this.voiceId }),
      })

      if (response.status === 501) {
        this.enabled = false
        return silent
      }
      if (!response.ok) return silent

      const data = (await response.json()) as SpeechResponse
      if (!data.audio) return silent

      const url = URL.createObjectURL(base64ToBlob(data.audio))
      this.urls.push(url)

      const audio = new Audio(url)
      audio.preload = 'auto'
      const duration = await metadataDuration(audio)

      if (data.alignment) this.aligned = true

      return {
        audio,
        duration: duration ?? silent.duration,
        timeOf: makeAnchorResolver(data.alignment),
      }
    } catch {
      return silent
    }
  }
}

/**
 * Builds a lookup from an anchor phrase to the moment it is spoken.
 *
 * The provider returns a start time per character of the narration, so finding
 * a phrase is just a case-insensitive substring search over those characters
 * and reading the timestamp at the match.
 */
function makeAnchorResolver(alignment: SpeechResponse['alignment']) {
  if (!alignment) return () => null

  const haystack = alignment.characters.join('').toLowerCase()

  return (phrase: string): number | null => {
    const needle = phrase.trim().toLowerCase()
    if (!needle) return null

    let index = haystack.indexOf(needle)

    // The model sometimes paraphrases its own anchor. Fall back to the longest
    // leading run of words that does appear, so a near-miss still lands close.
    if (index === -1) {
      const words = needle.split(/\s+/)
      for (let take = words.length - 1; take >= 1 && index === -1; take--) {
        index = haystack.indexOf(words.slice(0, take).join(' '))
      }
    }
    if (index === -1) return null

    const start = alignment.starts[index]
    return Number.isFinite(start) ? start : null
  }
}

function base64ToBlob(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: 'audio/mpeg' })
}

function metadataDuration(audio: HTMLAudioElement): Promise<number | null> {
  return new Promise((resolve) => {
    if (audio.readyState >= 1 && Number.isFinite(audio.duration)) {
      resolve(audio.duration)
      return
    }

    const done = (value: number | null) => {
      audio.removeEventListener('loadedmetadata', onLoad)
      audio.removeEventListener('error', onError)
      clearTimeout(timer)
      resolve(value)
    }
    const onLoad = () => done(Number.isFinite(audio.duration) ? audio.duration : null)
    const onError = () => done(null)
    const timer = setTimeout(() => done(null), 8000)

    audio.addEventListener('loadedmetadata', onLoad)
    audio.addEventListener('error', onError)
    audio.load()
  })
}
