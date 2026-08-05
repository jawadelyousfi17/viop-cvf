/**
 * The voices offered in the player. The server validates against this list
 * rather than passing whatever id the client sends, so the route can't be used
 * as an open proxy to arbitrary ElevenLabs voices on the account's key.
 *
 * Each carries its counterpart on the other provider, so the picker keeps
 * working when TTS_PROVIDER changes instead of silently selecting nothing. The
 * OpenAI names are from the original six, which every speech model accepts —
 * the newer ones are rejected by tts-1.
 */
export const VOICES = [
  { id: 'BZgkqPqms7Kj9ulSkVzn', name: 'Eve', openai: 'nova' },
  { id: 'uYXf8XasLslADfZ2MB4u', name: 'Hope', openai: 'shimmer' },
  { id: 'MClEFoImJXBTgLwdLI5n', name: 'Ivy', openai: 'fable' },
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
