'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { setRegistrationLock } from '@/lib/admin/actions'

type SaveStatus = 'idle' | 'saved' | 'error'

// A datetime-local input holds a LOCAL wall-clock string with no zone. To
// pre-fill it from a UTC instant we must shift by the local offset, otherwise
// the browser renders the raw UTC time as if it were local (the value drifts by
// the timezone offset on every reload).
function toLocalInputValue(iso: string): string {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}

export default function RegistrationLockForm({
  currentLockedAt,
  isLocked: initialIsLocked,
}: {
  currentLockedAt: string | null
  isLocked: boolean
}) {
  const t = useTranslations('admin')
  const [inputValue, setInputValue] = useState(
    currentLockedAt ? toLocalInputValue(currentLockedAt) : '',
  )
  const [isLocked, setIsLocked] = useState(initialIsLocked)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [isPending, startTransition] = useTransition()

  const handleLockNow = () => {
    const now = new Date().toISOString()
    setStatus('idle')
    startTransition(async () => {
      const result = await setRegistrationLock(now)
      setStatus(result.success ? 'saved' : 'error')
      if (result.success) {
        setInputValue(toLocalInputValue(now))
        setIsLocked(true)
        setTimeout(() => setStatus('idle'), 3000)
      }
    })
  }

  const handleSetDateTime = () => {
    if (!inputValue) return
    const utc = new Date(inputValue).toISOString()
    setStatus('idle')
    startTransition(async () => {
      const result = await setRegistrationLock(utc)
      setStatus(result.success ? 'saved' : 'error')
      if (result.success) setTimeout(() => setStatus('idle'), 3000)
    })
  }

  const handleRemoveLock = () => {
    setStatus('idle')
    startTransition(async () => {
      const result = await setRegistrationLock(null)
      setStatus(result.success ? 'saved' : 'error')
      if (result.success) {
        setInputValue('')
        setIsLocked(false)
        setTimeout(() => setStatus('idle'), 3000)
      }
    })
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">{t('registrationLock')}</h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isLocked
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${isLocked ? 'bg-red-500' : 'bg-green-500'}`}
          />
          {isLocked ? t('lockStatusLocked') : t('lockStatusOpen')}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t('lockDateTime')}</label>
          <input
            type="datetime-local"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <Button size="sm" onClick={handleSetDateTime} disabled={!inputValue || isPending}>
          {t('setLock')}
        </Button>

        <Button size="sm" variant="destructive" onClick={handleLockNow} disabled={isPending}>
          {t('lockNow')}
        </Button>

        {currentLockedAt && (
          <Button size="sm" variant="outline" onClick={handleRemoveLock} disabled={isPending}>
            {t('removeLock')}
          </Button>
        )}
      </div>

      {status === 'saved' && (
        <p className="text-sm text-green-600">{t('lockSaved')}</p>
      )}
      {status === 'error' && (
        <p className="text-sm text-destructive">{t('lockError')}</p>
      )}
    </section>
  )
}
