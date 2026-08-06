import OpenAI from 'openai'
import { cacheKey, readSpeech, writeSpeech } from '@/lib/tts-cache'
import {
  ELEVENLABS_DEFAULT_MODEL,
  FISH_DEFAULT_MODEL,
  OPENAI_DEFAULT_MODEL,
  resolveProvider,
  speechIdentity,
} from '@/lib/tts-identity'
import {
  DEFAULT_FISH_VOICE,
  DEFAULT_VOICE_ID,
  fishVoiceFor,
  isKnownVoice,
  openAIVoiceFor,
} from '@/lib/voices'

export const maxDuration = 120

const OPENAI_DEFAULT_VOICE = 'sage'

// "EVE". Alternatives: Hope uYXf8XasLslADfZ2MB4u, Ivy MClEFoImJXBTgLwdLI5n.
const ELEVENLABS_DEFAULT_VOICE = DEFAULT_VOICE_ID
// The quality model, not the latency-optimised turbo/flash ones. Scenes are
// prefetched a scene ahead, so the extra generation time is hidden anyway.

/**
 * Tuned for a teacher reading aloud rather than an announcer.
 *
 * `stability` is the important one: high values are what make TTS sound flat
 * and robotic, because the model stops varying pitch and pace between
 * sentences. Low values let it breathe, at the cost of occasional oddities.
 * `style` adds expressiveness but gets unstable past ~0.4.
 */
const ELEVENLABS_VOICE_SETTINGS = {
  stability: 0.35,
  similarity_boost: 0.8,
  style: 0.3,
  use_speaker_boost: true,
  speed: 0.96,
}

/** What the player receives, whichever provider produced it. */
export interface SpeechResponse {
  /** Base64 mp3. */
  audio: string
  /**
   * Per-character start times, aligned to the narration text. Null when the
   * provider doesn't return timing data, which makes the player fall back to
   * spreading shapes across the clip by their `at` fraction.
   */
  alignment: { characters: string[]; starts: number[] } | null
}

/**
 * Steers gpt-4o-mini-tts. Ignored by tts-1/tts-1-hd, which aren't steerable.
 * This is the main reason to prefer the newer model here: the delivery can be
 * told to sound like someone teaching at a board rather than reading a script.
 */
const VOICE_INSTRUCTIONS =
  'You are a warm, patient teacher explaining an idea at a whiteboard. Speak clearly and ' +
  'unhurriedly, in a natural conversational register. Land the key term in each sentence, ' +
  'and pause briefly at sentence boundaries so the listener can follow the drawing. ' +
  'Sound genuinely interested in the subject — never rushed, robotic, or announcer-like.'

/** OpenAI caps a single speech request at 4096 characters. */
const MAX_INPUT = 4000


/**
 * Narrates one scene. Returns mp3 bytes, or 501 when no usable key is
 * configured — the player treats that as "run this lesson silently" rather
 * than as a failure.
 */
export async function POST(request: Request) {
  let text: unknown
  let voiceId: unknown
  try {
    ;({ text, voiceId } = await request.json())
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  if (typeof text !== 'string' || !text.trim()) {
    return Response.json({ error: 'Nothing to say.' }, { status: 400 })
  }

  const input = text.trim().slice(0, MAX_INPUT)
  const provider = resolveProvider()

  // Only ids from the allowlist are honoured, whichever provider runs, so this
  // can't be used to bill arbitrary voices to the account's key.
  // Nothing about a recording changes between runs, and testing a board means
  // playing the same script over and over. Pay for it once.
  const { voice, model } = speechIdentity(voiceId)
  const key = cacheKey({ text: input, provider, voice, model })
  const cached = await readSpeech(key)
  if (cached) {
    return Response.json(cached satisfies SpeechResponse, {
      headers: { 'cache-control': 'no-store', 'x-tts-cache': 'hit' },
    })
  }

  const response =
    provider === 'openai'
      ? await speakWithOpenAI(input, openAIVoiceFor(voiceId))
      : provider === 'fish'
        ? await speakWithFish(input, fishVoiceFor(voiceId))
        : await speakWithElevenLabs(input, isKnownVoice(voiceId) ? voiceId : undefined)

  if (response.ok) {
    // Read from a clone: the original body still has to reach the player.
    const body = (await response.clone().json()) as SpeechResponse
    if (body.audio) await writeSpeech(key, body)
  }

  const headers = new Headers(response.headers)
  headers.set('x-tts-cache', 'miss')
  return new Response(response.body, { status: response.status, headers })
}

async function speakWithOpenAI(input: string, voice?: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'OPENAI_API_KEY is not set.' }, { status: 501 })
  }

  const model = process.env.OPENAI_TTS_MODEL ?? OPENAI_DEFAULT_MODEL
  const client = new OpenAI({ apiKey })

  try {
    const speech = await client.audio.speech.create({
      model,
      voice: voice ?? process.env.OPENAI_TTS_VOICE ?? OPENAI_DEFAULT_VOICE,
      input,
      response_format: 'mp3',
      // tts-1 and tts-1-hd reject this parameter outright.
      ...(model.startsWith('tts-1') ? {} : { instructions: VOICE_INSTRUCTIONS }),
    })

    const audio = Buffer.from(await speech.arrayBuffer()).toString('base64')
    // OpenAI's speech API returns no alignment data of any kind.
    return Response.json({ audio, alignment: null } satisfies SpeechResponse, {
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    console.error('[tts] openai error', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `OpenAI speech failed: ${message}` }, { status: 502 })
  }
}

/**
 * Fish Audio. Its speech endpoint returns audio and nothing else, so the timing
 * the board needs is recovered afterwards by transcribing what it just said —
 * see alignFish.
 */
async function speakWithFish(input: string, requested?: string) {
  const apiKey = process.env.FISH_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'FISH_API_KEY is not set.' }, { status: 501 })
  }

  const referenceId = requested ?? process.env.FISH_VOICE_ID ?? DEFAULT_FISH_VOICE
  if (!referenceId) {
    return Response.json({ error: 'No Fish Audio voice configured.' }, { status: 501 })
  }

  let audio: ArrayBuffer
  try {
    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        // Chooses the synthesis model; the header, oddly, not the body.
        model: process.env.FISH_MODEL ?? FISH_DEFAULT_MODEL,
      },
      body: JSON.stringify({
        text: input,
        reference_id: referenceId,
        format: 'mp3',
        mp3_bitrate: 128,
        // Unhurried, to match the teaching register the other providers get
        // through their own settings.
        prosody: { speed: 0.96 },
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[tts] fish error', response.status, detail)
      return Response.json({ error: `Fish Audio returned ${response.status}.` }, { status: 502 })
    }

    audio = await response.arrayBuffer()
  } catch (error) {
    console.error('[tts] fish request failed', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `Fish Audio failed: ${message}` }, { status: 502 })
  }

  if (!audio.byteLength) {
    return Response.json({ error: 'Fish Audio returned no audio.' }, { status: 502 })
  }

  return Response.json(
    {
      audio: Buffer.from(audio).toString('base64'),
      alignment: await alignFish(audio, input, apiKey),
    } satisfies SpeechResponse,
    { headers: { 'cache-control': 'no-store' } }
  )
}

/**
 * Recovers character timings for Fish audio by transcribing it.
 *
 * ElevenLabs hands back where every character falls, which is what lets a shape
 * be drawn on the word that describes it. Fish returns bare audio, so the clip
 * is sent straight back to Fish's own transcriber, which times every word it
 * hears.
 *
 * Those words are then matched back onto the narration the model wrote, rather
 * than used in its place — the player looks up anchor phrases in the original
 * text, so the character array has to be the original characters, punctuation
 * and all. Matching is by word and not by offset because a transcript agrees
 * with its source on the words and on almost nothing else: "small, fast" comes
 * back as "small" "fast", which over a couple of sentences is enough drift to
 * put every shape in the wrong place.
 *
 * Returns null on any failure — an unsynced lesson still plays.
 */
async function alignFish(
  audio: ArrayBuffer,
  input: string,
  apiKey: string
): Promise<SpeechResponse['alignment']> {
  if (process.env.FISH_ALIGNMENT === 'off') return null

  try {
    const form = new FormData()
    form.append('audio', new Blob([audio], { type: 'audio/mpeg' }), 'speech.mp3')
    form.append('language', process.env.FISH_LANGUAGE ?? 'en')
    form.append('ignore_timestamps', 'false')

    const response = await fetch('https://api.fish.audio/v1/asr', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!response.ok) {
      console.warn('[tts] fish alignment unavailable', response.status)
      return null
    }

    const data = (await response.json()) as {
      duration?: number
      segments?: { text?: string; start?: number; end?: number }[]
    }
    const segments = (data.segments ?? []).filter(
      (segment) =>
        typeof segment.start === 'number' &&
        typeof segment.end === 'number' &&
        segment.text?.trim()
    )
    if (!segments.length) return null

    // Split by UTF-16 unit, so an index into this array is also an index the
    // regex below produces.
    const characters = input.split('')
    const starts = new Array<number>(characters.length).fill(0)

    const WORD = /[\p{L}\p{N}']+/gu
    const words = [...input.matchAll(WORD)].map((match) => ({
      text: match[0].toLowerCase(),
      from: match.index,
      to: match.index + match[0].length,
    }))
    if (!words.length) return null

    // Each transcribed word, placed at the source word it belongs to.
    const timed: { from: number; to: number; start: number; end: number }[] = []
    let next = 0

    for (const segment of segments) {
      const spoken = segment.text!.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')
      if (!spoken) continue

      // A short lookahead, so one misheard word costs one word rather than
      // throwing the rest of the sentence out of step.
      let found = -1
      for (let i = next; i < Math.min(words.length, next + 8); i++) {
        if (words[i].text === spoken) {
          found = i
          break
        }
      }
      if (found === -1) continue

      next = found + 1
      timed.push({ ...words[found], start: segment.start!, end: segment.end! })
    }
    if (!timed.length) return null

    // Spaces and punctuation between two words hold the earlier word's end, so
    // a shape anchored just after a phrase waits for that phrase to finish.
    let cursor = 0
    let previous = 0
    for (const word of timed) {
      for (let i = cursor; i < word.from; i++) starts[i] = previous
      const span = Math.max(1, word.to - word.from)
      for (let i = word.from; i < word.to; i++) {
        starts[i] = word.start + ((word.end - word.start) * (i - word.from)) / span
      }
      previous = word.end
      cursor = word.to
    }
    for (let i = cursor; i < starts.length; i++) starts[i] = previous

    return { characters, starts }
  } catch (error) {
    console.warn('[tts] fish alignment failed', error)
    return null
  }
}

async function speakWithElevenLabs(input: string, requested?: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ELEVENLABS_API_KEY is not set.' }, { status: 501 })
  }

  const voiceId = requested ?? process.env.ELEVENLABS_VOICE_ID ?? ELEVENLABS_DEFAULT_VOICE

  // The /with-timestamps variant returns character-level timing alongside the
  // audio, which is what lets shapes land on the word that describes them.
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        text: input,
        model_id: process.env.ELEVENLABS_MODEL_ID ?? ELEVENLABS_DEFAULT_MODEL,
        voice_settings: ELEVENLABS_VOICE_SETTINGS,
      }),
    }
  )

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('[tts] elevenlabs error', response.status, detail)
    return Response.json({ error: `ElevenLabs returned ${response.status}.` }, { status: 502 })
  }

  const data = (await response.json()) as {
    audio_base64?: string
    alignment?: { characters?: string[]; character_start_times_seconds?: number[] } | null
  }

  if (!data.audio_base64) {
    return Response.json({ error: 'ElevenLabs returned no audio.' }, { status: 502 })
  }

  const characters = data.alignment?.characters
  const starts = data.alignment?.character_start_times_seconds

  return Response.json(
    {
      audio: data.audio_base64,
      alignment:
        characters && starts && characters.length === starts.length
          ? { characters, starts }
          : null,
    } satisfies SpeechResponse,
    { headers: { 'cache-control': 'no-store' } }
  )
}
