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
/** Fish Audio's current high-quality general TTS model. */
export const FISH_DEFAULT_MODEL = 's2-pro'
/**
 * Flash v2.5: the latency-optimised model. Sections are synthesised one by
 * one the moment they stream in, so what matters is how fast the FIRST one
 * comes back — and flash returns character timestamps like the rest.
 */
export const ELEVENLABS_DEFAULT_MODEL = 'eleven_flash_v2_5'

export type TtsProvider = 'openai' | 'elevenlabs' | 'fish'

const PROVIDERS = new Set<TtsProvider>(['openai', 'elevenlabs', 'fish'])

export function resolveProvider(): TtsProvider {
  const configured = process.env.TTS_PROVIDER?.toLowerCase()
  if (PROVIDERS.has(configured as TtsProvider)) return configured as TtsProvider
  // The house voice is ElevenLabs — flash is fast enough to synthesise each
  // section as it arrives, and it returns the timestamps the board draws by.
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs'
  return process.env.OPENAI_API_KEY ? 'openai' : 'fish'
}

/**
 * Fish requires its model in a request header, and currently documents only
 * `s1` and `s2-pro`. Map the old value we used in local env files so existing
 * installs keep working while their cache keys describe the actual recording.
 */
export function fishModel() {
  return process.env.FISH_MODEL === 's1' ? 's1' : FISH_DEFAULT_MODEL
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
        ? fishModel()
        : (process.env.ELEVENLABS_MODEL_ID ?? ELEVENLABS_DEFAULT_MODEL)

  return { provider, voice, model }
}
