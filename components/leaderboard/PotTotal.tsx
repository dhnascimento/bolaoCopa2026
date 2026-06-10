'use client'
import { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'

const STORAGE_KEY = 'potCurrency'

// Tiny localStorage-backed store for the chosen pot currency. Using
// useSyncExternalStore keeps reads hydration-safe (server snapshot is null) and
// avoids setState-in-effect.
const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(value: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // ignore (private mode etc.)
  }
  listeners.forEach((l) => l())
}

// Total-pot display with an optional currency toggle (e.g. BRL ⇄ CAD). The
// amounts are pre-formatted server-side; this only switches which one shows and
// remembers the choice in localStorage.
export default function PotTotal({
  amounts,
  currencies,
  defaultCurrency,
}: {
  amounts: Record<string, string>
  currencies: string[]
  defaultCurrency: string
}) {
  const t = useTranslations()
  const stored = useSyncExternalStore(
    subscribe,
    readStored,
    () => null, // server snapshot — fall back to defaultCurrency
  )
  const currency = stored && currencies.includes(stored) ? stored : defaultCurrency

  return (
    <div className="shrink-0 text-right">
      <p className="eyebrow text-[0.7rem] text-muted-foreground">{t('common.potTotal')}</p>
      <p className="font-heading text-3xl font-bold italic tabular-nums text-primary">
        {amounts[currency] ?? amounts[defaultCurrency]}
      </p>

      {currencies.length > 1 && (
        <div
          role="group"
          aria-label={t('leaderboard.currency')}
          className="mt-1 inline-flex items-center rounded-md border p-0.5"
        >
          {currencies.map((c) => {
            const isActive = c === currency
            return (
              <button
                key={c}
                type="button"
                aria-pressed={isActive}
                onClick={() => writeStored(c)}
                className={`cursor-pointer rounded px-2 py-0.5 font-heading text-xs font-bold uppercase tracking-wide transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {c}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
