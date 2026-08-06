import { fishVoiceFor, isKnownVoice, openAIVoiceFor } from './voices'

/**
 * Which provider, voice and model a request will actually use.
 *
 * Split out from the speech route because two callers need the same answer:
 * the route, to key the cache it writes, and the script list, to say whether a
 * script's narration is already recorded. If those two disagreed about what a
 * recording is, the list would confidently report audio that the player then
 * goes and pays to synthesise again.
 */

export const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini-tts'
export const FISH_DEFAULT_MODEL = 's2.1-pro'
export const ELEVENLABS_DEFAULT_MODEL = 'eleven_v3'

export type TtsProvider = 'openai' | 'elevenlabs' | 'fish'

const PROVIDERS = new Set<TtsProvider>(['openai', 'elevenlabs', 'fish'])

export function resolveProvider(): TtsProvider {
  const configured = process.env.TTS_PROVIDER?.toLowerCase()
  if (PROVIDERS.has(configured as TtsProvider)) return configured as TtsProvider
  // Nothing pinned: use whichever key is present, preferring OpenAI so a single
  // key is enough to run the whole app.
  if (process.env.OPENAI_API_KEY) return 'openai'
  return process.env.FISH_API_KEY ? 'fish' : 'elevenlabs'
}

export function speechIdentity(voiceId: unknown) {
  const provider = resolveProvider()

  const voice =
    (provider === 'openai'
      ? openAIVoiceFor(voiceId)
      : provider === 'fish'
        ? fishVoiceFor(voiceId)
        : isKnownVoice(voiceId)
          ? voiceId
          : undefined) ?? 'default'

  const model =
    provider === 'openai'
      ? (process.env.OPENAI_TTS_MODEL ?? OPENAI_DEFAULT_MODEL)
      : provider === 'fish'
        ? (process.env.FISH_MODEL ?? FISH_DEFAULT_MODEL)
        : (process.env.ELEVENLABS_MODEL_ID ?? ELEVENLABS_DEFAULT_MODEL)

  return { provider, voice, model }
}
