import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Narration kept in Supabase Storage, so a recording outlives the machine that
 * made it.
 *
 * The disk cache underneath this exists for local work and is right there:
 * synthesising the same script fifty times while testing the board should cost
 * one request, not fifty. In production it is useless — the filesystem is
 * read-only outside /tmp, so every write failed silently and every replay of a
 * saved lesson paid for the whole thing again. A lesson someone watches twice
 * was being bought twice.
 *
 * One object per recording, keyed by exactly what the disk cache keys on: the
 * text, the provider, the voice, the model and the pace. Nothing invalidates,
 * because a different sound is a different key.
 *
 * Configured or not: with no bucket and no keys this returns null from every
 * read and does nothing on every write, and the disk cache carries on as it
 * did. Nothing here is allowed to fail a request — a cache that throws is
 * worse than no cache.
 */

const BUCKET = process.env.SUPABASE_TTS_BUCKET?.trim() || 'tts-audio'

/**
 * The key writes go out under.
 *
 * The service-role key if there is one, since it is not subject to the
 * bucket's policies and this only ever runs on the server. Otherwise the
 * publishable key, which works only if the bucket has an insert policy — so a
 * deployment with neither simply gets no cache rather than an error on every
 * lesson.
 */
function credentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

  return url && key ? { url, key } : null
}

let client: SupabaseClient | null | undefined

function storage() {
  if (client === undefined) {
    const found = credentials()
    client = found
      ? createClient(found.url, found.key, { auth: { persistSession: false } })
      : null
  }
  return client
}

export const storeConfigured = () => Boolean(credentials())

/** One object per recording. `.json` because it carries the timings too. */
const objectFor = (key: string) => `${key}.json`

export interface StoredSpeech {
  audio: string
  alignment: { characters: string[]; starts: number[] } | null
}

export async function readStored(key: string): Promise<StoredSpeech | null> {
  const supabase = storage()
  if (!supabase) return null

  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(objectFor(key))
    if (error || !data) return null

    const parsed = JSON.parse(await data.text()) as StoredSpeech
    return parsed.audio ? parsed : null
  } catch {
    // A miss, a network blip, or half an object. Synthesise it again.
    return null
  }
}

export async function writeStored(key: string, value: StoredSpeech): Promise<void> {
  const supabase = storage()
  if (!supabase) return

  try {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(objectFor(key), JSON.stringify(value), {
        contentType: 'application/json',
        // Two tabs can ask for the same line at the same moment and both miss.
        // They are writing identical bytes, so let the second one win rather
        // than treating it as a conflict.
        upsert: true,
      })

    if (error) {
      // Loud once, because the usual cause is a bucket that does not exist or
      // a policy that forbids the write, and the symptom otherwise is only a
      // bill.
      warnOnce(`[tts] could not store audio in "${BUCKET}": ${error.message}`)
    }
  } catch (error) {
    warnOnce(`[tts] could not store audio: ${String(error)}`)
  }
}

let warned = false
function warnOnce(message: string) {
  if (warned) return
  warned = true
  console.warn(message)
}
