/**
 * The voices offered in the player. The server validates against this list
 * rather than passing whatever id the client sends, so the route can't be used
 * as an open proxy to arbitrary voices on the account's key.
 *
 * Each carries its counterpart on the other providers, so the picker keeps
 * working when TTS_PROVIDER changes instead of silently selecting nothing. The
 * OpenAI names are from the original six, which every speech model accepts —
 * the newer ones are rejected by tts-1. Fish has two voices on the account, so
 * the third falls back to whichever is configured as the default.
 */
export const VOICES = [
  {
    id: 'BZgkqPqms7Kj9ulSkVzn',
    name: 'Eve',
    openai: 'nova',
    fish: '27f7e4eb74684b8c9dc1b1a52ce51d65',
  },
  {
    id: 'uYXf8XasLslADfZ2MB4u',
    name: 'Hope',
    openai: 'shimmer',
    fish: 'cd8978d42e1d40bd87056fd79ee9208c',
  },
  { id: 'MClEFoImJXBTgLwdLI5n', name: 'Ivy', openai: 'fable', fish: undefined },
] as const

export type VoiceId = (typeof VOICES)[number]['id']

export const DEFAULT_VOICE_ID: VoiceId = VOICES[0].id

export function isKnownVoice(id: unknown): id is VoiceId {
  return typeof id === 'string' && VOICES.some((voice) => voice.id === id)
}

/** The OpenAI voice standing in for a picked voice, if it maps to one. */
export function openAIVoiceFor(id: unknown): string | undefined {
  return VOICES.find((voice) => voice.id === id)?.openai
}

/** The Fish Audio model id standing in for a picked voice, if it maps to one. */
export function fishVoiceFor(id: unknown): string | undefined {
  return VOICES.find((voice) => voice.id === id)?.fish
}

/** Stands in for a voice with no Fish counterpart, so the picker never 501s. */
export const DEFAULT_FISH_VOICE = VOICES.find((voice) => voice.fish)?.fish
