'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m ${seconds}s`
}

export function LockCountdown({ lockAt }: { lockAt: string }) {
  const t = useTranslations('fixtures')
  const lockTime = new Date(lockAt).getTime()
  // Start null so the server and first client render agree (no Date.now() during
  // SSR/hydration); the real value is filled in after mount. Avoids a hydration
  // mismatch on the live countdown text.
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, lockTime - Date.now()))
    // Seed via a 0ms timer (a callback, not a synchronous effect-body setState)
    // so the first value lands right after mount without a hydration mismatch.
    const seed = setTimeout(update, 0)
    const id = setInterval(update, 1000)
    return () => {
      clearTimeout(seed)
      clearInterval(id)
    }
  }, [lockTime])

  if (remaining === null || remaining <= 0) return null

  return (
    <span className="text-xs text-amber-500 font-medium">
      {t('locksIn', { time: formatDuration(remaining) })}
    </span>
  )
}
