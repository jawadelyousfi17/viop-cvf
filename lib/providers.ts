/**
 * Which model writes the lesson.
 *
 * The two produce noticeably different boards from the same prompt, and the
 * only way to judge that is to switch between them on one topic — so this is a
 * choice on the topic screen rather than a deployment setting.
 */

export const PROVIDERS = ['openai', 'claude'] as const
export type Provider = (typeof PROVIDERS)[number]

export const DEFAULT_PROVIDER: Provider = 'openai'

export function isProvider(value: unknown): value is Provider {
  return PROVIDERS.includes(value as Provider)
}

export const PROVIDER_LABELS: Record<Provider, { name: string; hint: string }> = {
  openai: { name: 'OpenAI', hint: 'gpt-5.6-luna' },
  claude: { name: 'Claude', hint: 'Sonnet 5' },
}

export const DEFAULT_MODELS: Record<Provider, string> = {
  openai: 'gpt-5.6-luna',
  claude: 'claude-sonnet-5',
}

/**
 * The model for the calls someone is sitting and waiting through.
 *
 * A lesson is generated once and watched for minutes, so it is worth the best
 * model on the account. A question asked mid-lesson is the opposite: the board
 * is stopped, the voice has gone quiet, and the person who typed it is looking
 * at a paused screen — every second is a second of nothing happening. A board
 * that is a little less considered but arrives while they still remember what
 * they asked is the better answer.
 *
 * Measured on the answer prompt, median of three, rather than assumed:
 *
 *     gpt-5.4-mini   4.0s   (3.8 / 4.0 / 4.1)
 *     gpt-5.4-nano   5.0s
 *     gpt-5.6-luna   5.1s   (4.9 / 5.1 / 8.9)
 *     gpt-4o-mini    6.2s
 *
 * All four returned a valid five-to-eight-shape scene every time. The mini is
 * both the quickest and the steadiest — luna's spread is the real cost, since a
 * pause is judged by its worst case and not its median. The older 4o-mini is
 * the slowest of the four, which is worth writing down because it is the one
 * you would reach for by name.
 */
export const FAST_MODELS: Record<Provider, string> = {
  openai: process.env.OPENAI_FAST_MODEL ?? 'gpt-5.4-mini',
  claude: process.env.ANTHROPIC_FAST_MODEL ?? 'claude-haiku-4-5-20251001',
}

/**
 * The variants offered in the picker, per provider.
 *
 * A board is a hard thing to judge from a description, and the same prompt
 * produces noticeably different boards on different models — so which one runs
 * is a choice on the topic screen, next to which provider does, rather than a
 * setting you have to redeploy to change.
 *
 * `MODEL_VARIANTS` can be overridden per environment, because this list dates
 * faster than anything else in the file.
 */
export const MODEL_VARIANTS: Record<Provider, string[]> = {
  openai: envList('OPENAI_MODELS') ?? ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol'],
  claude: envList('ANTHROPIC_MODELS') ?? ['claude-sonnet-5', 'claude-opus-5', 'claude-fable-5'],
}

function envList(name: string) {
  const raw = process.env[name]
  if (!raw?.trim()) return null
  const names = raw.split(',').map((entry) => entry.trim()).filter(Boolean)
  return names.length ? names : null
}

/** The short half of a model name — what the picker shows. */
export function modelLabel(model: string) {
  const short = model.replace(/^(gpt|claude)-/, '').replace(/^[\d.]+-/, '')
  return short || model
}

/**
 * Whether a name is one this deployment is willing to call.
 *
 * The fast model counts. It is never offered in the picker — it is chosen by
 * the routes that answer while someone waits — but it is a name this
 * deployment has decided on, which is what this list means. Without it here
 * the allowlist would quietly swap it back for the slow default.
 */
export function isKnownModel(provider: Provider, model: unknown): model is string {
  if (typeof model !== 'string') return false
  return MODEL_VARIANTS[provider].includes(model) || FAST_MODELS[provider] === model
}

/**
 * Which model to call. A requested one is honoured only if it is on the
 * provider's list — the name reaches here from the browser, and an arbitrary
 * string would let anyone bill this key against any model on the account.
 */
export function modelFor(provider: Provider, requested?: unknown) {
  if (isKnownModel(provider, requested)) return requested

  const configured =
    provider === 'claude' ? process.env.ANTHROPIC_MODEL : process.env.OPENAI_MODEL
  return configured ?? MODEL_VARIANTS[provider][0] ?? DEFAULT_MODELS[provider]
}
