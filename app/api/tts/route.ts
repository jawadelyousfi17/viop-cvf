import OpenAI from 'openai'
import { DEFAULT_VOICE_ID, isKnownVoice } from '@/lib/voices'

export const maxDuration = 120

const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini-tts'
const OPENAI_DEFAULT_VOICE = 'sage'

// "EVE". Alternatives: Hope uYXf8XasLslADfZ2MB4u, Ivy MClEFoImJXBTgLwdLI5n.
const ELEVENLABS_DEFAULT_VOICE = DEFAULT_VOICE_ID
// The quality model, not the latency-optimised turbo/flash ones. Scenes are
// prefetched a scene ahead, so the extra generation time is hidden anyway.
const ELEVENLABS_DEFAULT_MODEL = 'eleven_v3'

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

type Provider = 'openai' | 'elevenlabs'

function resolveProvider(): Provider {
  const configured = process.env.TTS_PROVIDER?.toLowerCase()
  if (configured === 'openai' || configured === 'elevenlabs') return configured
  // Neither pinned: use whichever key is present, preferring OpenAI so a single
  // key is enough to run the whole app.
  return process.env.OPENAI_API_KEY ? 'openai' : 'elevenlabs'
}

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

  return provider === 'openai'
    ? speakWithOpenAI(input)
    : // Only ids from the allowlist are honoured, so this can't be used to
      // bill arbitrary voices to the account's key.
      speakWithElevenLabs(input, isKnownVoice(voiceId) ? voiceId : undefined)
}

async function speakWithOpenAI(input: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'OPENAI_API_KEY is not set.' }, { status: 501 })
  }

  const model = process.env.OPENAI_TTS_MODEL ?? OPENAI_DEFAULT_MODEL
  const client = new OpenAI({ apiKey })

  try {
    const speech = await client.audio.speech.create({
      model,
      voice: process.env.OPENAI_TTS_VOICE ?? OPENAI_DEFAULT_VOICE,
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
