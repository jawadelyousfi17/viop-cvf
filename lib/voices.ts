/**
 * The voices offered in the player. The server validates against this list
 * rather than passing whatever id the client sends, so the route can't be used
 * as an open proxy to arbitrary ElevenLabs voices on the account's key.
 */
export const VOICES = [
  { id: 'BZgkqPqms7Kj9ulSkVzn', name: 'Eve' },
  { id: 'uYXf8XasLslADfZ2MB4u', name: 'Hope' },
  { id: 'MClEFoImJXBTgLwdLI5n', name: 'Ivy' },
] as const

export type VoiceId = (typeof VOICES)[number]['id']

export const DEFAULT_VOICE_ID: VoiceId = VOICES[0].id

export function isKnownVoice(id: unknown): id is VoiceId {
  return typeof id === 'string' && VOICES.some((voice) => voice.id === id)
}
