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

export function modelFor(provider: Provider) {
  return provider === 'claude'
    ? (process.env.ANTHROPIC_MODEL ?? DEFAULT_MODELS.claude)
    : (process.env.OPENAI_MODEL ?? DEFAULT_MODELS.openai)
}
