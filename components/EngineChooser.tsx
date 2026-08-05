'use client'

import { ENGINES, ENGINE_LABELS, type Engine } from '@/lib/engines'

/**
 * Segmented control for picking the rendering engine. Shown on the topic
 * screen only — switching mid-lesson would mean regenerating it, since the two
 * engines speak different lesson languages.
 */
export function EngineChooser({
  value,
  onChange,
  disabled,
}: {
  value: Engine
  onChange: (engine: Engine) => void
  disabled?: boolean
}) {
  return (
    <div>
      <div className="inline-flex rounded-xl bg-zinc-100 p-1">
        {ENGINES.map((engine) => {
          const active = engine === value
          return (
            <button
              key={engine}
              type="button"
              disabled={disabled}
              onClick={() => onChange(engine)}
              aria-pressed={active}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {ENGINE_LABELS[engine].name}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-[13px] text-zinc-400">{ENGINE_LABELS[value].hint}</p>
    </div>
  )
}
