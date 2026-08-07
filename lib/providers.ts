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

/** Whether a name is one this deployment is willing to call. */
export function isKnownModel(provider: Provider, model: unknown): model is string {
  return typeof model === 'string' && MODEL_VARIANTS[provider].includes(model)
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
