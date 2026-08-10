import OpenAI from 'openai'
import { cacheKey, readSpeech, writeSpeech } from '@/lib/tts-cache'
import {
  ELEVENLABS_DEFAULT_MODEL,
  fishModel,
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
  // Normal speed. The low `stability` above is what gives the delivery its
  // unhurried, teacherly feel; slowing the playback on top of that dragged.
  speed: 1.0,
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
  const key = cacheKey({
    text: input,
    provider,
    voice,
    model,
    ...(provider === 'elevenlabs' ? { pace: ELEVENLABS_VOICE_SETTINGS.speed } : {}),
  })
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
  // Which engine actually spoke — so "are we on flash?" is a curl, not a hunch.
  headers.set('x-tts-identity', `${provider}/${model}/${voice}`)
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
 * Fish Audio streams both audio and word timestamps. Reading the whole stream
 * here still gives the player one ordinary MP3 response, while its alignment
 * data lets the board draw with the teacher rather than after the fact.
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

  let speech: FishSpeech
  try {
    const response = await fetch('https://api.fish.audio/v1/tts/stream/with-timestamp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        // Fish chooses the synthesis model from this required header.
        model: fishModel(),
      },
      body: JSON.stringify({
        text: input,
        reference_id: referenceId,
        format: 'mp3',
        sample_rate: 44100,
        mp3_bitrate: 128,
        normalize: true,
        chunk_length: 300,
        latency: 'balanced',
        // Unhurried, to match the teaching register the other providers get
        // through their own settings.
        prosody: { speed: 0.96, normalize_loudness: true },
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[tts] fish error', response.status, detail)
      return Response.json({ error: `Fish Audio returned ${response.status}.` }, { status: 502 })
    }

    speech = await readFishStream(response)
  } catch (error) {
    console.error('[tts] fish request failed', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `Fish Audio failed: ${message}` }, { status: 502 })
  }

  if (!speech.audio.byteLength) {
    return Response.json({ error: 'Fish Audio returned no audio.' }, { status: 502 })
  }

  return Response.json(
    {
      audio: speech.audio.toString('base64'),
      alignment:
        process.env.FISH_ALIGNMENT === 'off'
          ? null
          : alignmentFromFish(input, speech.segments) ??
            (await alignFishWithAsr(speech.audio, input, apiKey)),
    } satisfies SpeechResponse,
    { headers: { 'cache-control': 'no-store' } }
  )
}

/**
 * The finished events from Fish's timestamped stream. `alignment` is a
 * snapshot, not an append-only delta, so it is retained by chunk sequence and
 * only the newest snapshot for each text chunk reaches this function.
 */
interface FishSegment {
  text?: string
  start?: number
  end?: number
}

interface FishSpeech {
  audio: Buffer
  segments: FishSegment[]
}

interface FishStreamEvent {
  audio_base64?: string
  chunk_seq?: number
  chunk_audio_offset_sec?: number
  alignment?: { segments?: FishSegment[] } | null
}

/** Read Fish's SSE stream into one MP3 and its last alignment snapshots. */
async function readFishStream(response: Response): Promise<FishSpeech> {
  if (!response.body) throw new Error('Fish Audio returned an empty stream.')

  const decoder = new TextDecoder()
  const audio: Buffer[] = []
  const alignments = new Map<number, { offset: number; segments: FishSegment[] }>()
  let pending = ''

  const receive = (event: string) => {
    const payload = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
    if (!payload || payload === '[DONE]') return

    let data: FishStreamEvent
    try {
      data = JSON.parse(payload) as FishStreamEvent
    } catch {
      // A malformed progress event must not throw away usable audio from the
      // rest of the stream. Fish will still close the response with the real
      // error status if synthesis itself failed.
      console.warn('[tts] ignored malformed Fish stream event')
      return
    }

    if (data.audio_base64) audio.push(Buffer.from(data.audio_base64, 'base64'))
    if (
      typeof data.chunk_seq === 'number' &&
      data.alignment?.segments?.length
    ) {
      alignments.set(data.chunk_seq, {
        offset: data.chunk_audio_offset_sec ?? 0,
        segments: data.alignment.segments,
      })
    }
  }

  const reader = response.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    pending += decoder.decode(value, { stream: true })
    // Normalise after appending, rather than per network chunk: a CRLF pair
    // is allowed to arrive split across two chunks.
    pending = pending.replace(/\r\n/g, '\n')
    let boundary = pending.indexOf('\n\n')
    while (boundary !== -1) {
      receive(pending.slice(0, boundary))
      pending = pending.slice(boundary + 2)
      boundary = pending.indexOf('\n\n')
    }
  }
  pending += decoder.decode()
  if (pending.trim()) receive(pending)

  const segments = [...alignments.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([, snapshot]) =>
      snapshot.segments.map((segment) => ({
        ...segment,
        start: typeof segment.start === 'number' ? segment.start + snapshot.offset : undefined,
        end: typeof segment.end === 'number' ? segment.end + snapshot.offset : undefined,
      }))
    )

  return { audio: Buffer.concat(audio), segments }
}

/**
 * Converts Fish word/phrase timings into character start times for the player.
 *
 * Alignment text is close to the script but loses punctuation and can combine
 * a few words into one segment. Match words back to the source instead of
 * trusting offsets, then spread a phrase's duration across its words.
 */
function alignmentFromFish(
  input: string,
  segments: FishSegment[]
): SpeechResponse['alignment'] {
  const usable = segments.filter(
    (segment) =>
      typeof segment.start === 'number' &&
      typeof segment.end === 'number' &&
      segment.end >= segment.start &&
      segment.text?.trim()
  )
  if (!usable.length) return null

  const characters = input.split('')
  const starts = new Array<number>(characters.length).fill(0)
  const WORD = /[\p{L}\p{N}']+/gu
  const words = [...input.matchAll(WORD)].map((match) => ({
    text: match[0].toLowerCase(),
    from: match.index!,
    to: match.index! + match[0].length,
  }))
  if (!words.length) return null

  const timed: { from: number; to: number; start: number; end: number }[] = []
  let next = 0

  for (const segment of usable) {
    const spoken = [...segment.text!.matchAll(WORD)].map((match) => match[0].toLowerCase())
    for (const [index, text] of spoken.entries()) {
      let found = -1
      for (let candidate = next; candidate < Math.min(words.length, next + 12); candidate++) {
        if (words[candidate].text === text) {
          found = candidate
          break
        }
      }
      if (found === -1) continue

      next = found + 1
      const start = segment.start! + ((segment.end! - segment.start!) * index) / spoken.length
      const end = segment.start! + ((segment.end! - segment.start!) * (index + 1)) / spoken.length
      timed.push({ ...words[found], start, end })
    }
  }
  if (!timed.length) return null

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
}

/**
 * Last-resort timing recovery for a Fish response without stream timestamps.
 *
 * This should be unusual: the timestamped endpoint above is the normal route.
 * Retaining the fallback means a provider-side partial response still plays in
 * sync when its audio is valid but its timing snapshot is absent.
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
async function alignFishWithAsr(
  audio: Buffer,
  input: string,
  apiKey: string
): Promise<SpeechResponse['alignment']> {
  if (process.env.FISH_ALIGNMENT === 'off') return null

  try {
    const form = new FormData()
    // Buffer can be backed by a SharedArrayBuffer in recent Node typings,
    // while Blob deliberately accepts only a transferable ArrayBuffer. Make a
    // compact copy for this exceptional ASR fallback.
    const audioBytes = new Uint8Array(audio.byteLength)
    audioBytes.set(audio)
    form.append('audio', new Blob([audioBytes], { type: 'audio/mpeg' }), 'speech.mp3')
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
