'use client'

import { MODEL_VARIANTS, modelLabel, type Provider } from '@/lib/providers'

/**
 * Which variant of the chosen provider's model writes the lesson.
 *
 * Sits beside the provider chooser rather than under a settings menu: the
 * same prompt produces noticeably different boards on different variants, and
 * the only way to judge that is to run one topic through two of them and look.
 * Redeploying to compare is not looking.
 */
export function ModelChooser({
  provider,
  value,
  onChange,
  disabled,
}: {
  provider: Provider
  value: string
  onChange: (model: string) => void
  disabled?: boolean
}) {
  const variants = MODEL_VARIANTS[provider]
  if (variants.length < 2) return null

  return (
    <div>
      <div className="inline-flex rounded-xl bg-zinc-100 p-1">
        {variants.map((model) => {
          const active = model === value
          return (
            <button
              key={model}
              type="button"
              disabled={disabled}
              onClick={() => onChange(model)}
              aria-pressed={active}
              title={model}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium capitalize transition disabled:cursor-not-allowed disabled:opacity-50 ${
                active ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {modelLabel(model)}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-[13px] text-zinc-400">{value}</p>
    </div>
  )
}
