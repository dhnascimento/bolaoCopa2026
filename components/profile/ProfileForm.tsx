'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { updateDisplayName } from '@/lib/profile/actions'

type SaveStatus = 'idle' | 'saved' | 'error-empty' | 'error'

export default function ProfileForm({ initialName }: { initialName: string }) {
  const t = useTranslations('profile')
  const [name, setName] = useState(initialName)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    setStatus('idle')
    startTransition(async () => {
      const result = await updateDisplayName(name)
      if (result.success) {
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 3000)
      } else {
        setStatus(result.error === 'empty' ? 'error-empty' : 'error')
      }
    })
  }

  const unchanged = name.trim() === initialName.trim()

  return (
    <div className="max-w-sm space-y-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="display_name" className="text-sm font-medium">
          {t('displayNameLabel')}
        </label>
        <input
          id="display_name"
          type="text"
          value={name}
          maxLength={40}
          onChange={(e) => {
            setName(e.target.value)
            setStatus('idle')
          }}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          autoComplete="off"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={isPending || unchanged || name.trim() === ''}
        >
          {isPending ? t('saving') : t('save')}
        </Button>
        {status === 'saved' && (
          <span className="text-sm font-medium text-brand dark:text-sage">{t('saved')}</span>
        )}
        {status === 'error-empty' && (
          <span className="text-sm text-destructive">{t('errorEmpty')}</span>
        )}
        {status === 'error' && (
          <span className="text-sm text-destructive">{t('errorSave')}</span>
        )}
      </div>
    </div>
  )
}
