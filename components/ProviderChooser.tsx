'use client'

import { PROVIDERS, PROVIDER_LABELS, type Provider } from '@/lib/providers'

/**
 * Segmented control for picking which model writes the lesson. Sits beside the
 * engine chooser on the topic screen: the engine decides how a lesson is drawn,
 * this decides who plans it.
 */
export function ProviderChooser({
  value,
  onChange,
  disabled,
}: {
  value: Provider
  onChange: (provider: Provider) => void
  disabled?: boolean
}) {
  return (
    <div>
      <div className="inline-flex rounded-xl bg-zinc-100 p-1">
        {PROVIDERS.map((provider) => {
          const active = provider === value
          return (
            <button
              key={provider}
              type="button"
              disabled={disabled}
              onClick={() => onChange(provider)}
              aria-pressed={active}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                active ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {PROVIDER_LABELS[provider].name}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-[13px] text-zinc-400">{PROVIDER_LABELS[value].hint}</p>
    </div>
  )
}
