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
  const [remaining, setRemaining] = useState(() => Math.max(0, lockTime - Date.now()))

  useEffect(() => {
    if (remaining <= 0) return
    const id = setInterval(() => {
      setRemaining(Math.max(0, lockTime - Date.now()))
    }, 1000)
    return () => clearInterval(id)
  }, [lockTime]) // eslint-disable-line react-hooks/exhaustive-deps

  if (remaining <= 0) return null

  return (
    <span className="text-xs text-amber-500 font-medium">
      {t('locksIn', { time: formatDuration(remaining) })}
    </span>
  )
}
