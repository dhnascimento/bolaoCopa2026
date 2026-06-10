'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { inviteUser } from '@/lib/admin/invite-actions'

type InviteStatus = 'idle' | 'sent' | 'exists' | 'rate_limited' | 'error'

export default function InviteForm() {
  const t = useTranslations('admin')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [locale, setLocale] = useState('pt-BR')
  const [status, setStatus] = useState<InviteStatus>('idle')
  const [isPending, startTransition] = useTransition()

  const handleInvite = () => {
    if (!email || !displayName) return
    setStatus('idle')
    startTransition(async () => {
      const result = await inviteUser(email.trim(), displayName.trim(), locale)
      if (result.success) {
        setStatus('sent')
        setEmail('')
        setDisplayName('')
        setTimeout(() => setStatus('idle'), 4000)
      } else if (result.error === 'already_exists') {
        setStatus('exists')
      } else if (result.error === 'rate_limited') {
        setStatus('rate_limited')
      } else {
        setStatus('error')
      }
    })
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <h2 className="text-base font-semibold">{t('inviteTitle')}</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t('inviteEmail')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t('inviteName')}</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="João Silva"
            className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t('inviteLocale')}</label>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="cursor-pointer rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="pt-BR">PT-BR</option>
            <option value="en">EN</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={handleInvite}
          disabled={!email || !displayName || isPending}
        >
          {isPending ? t('inviteSending') : t('inviteSend')}
        </Button>

        {status === 'sent' && (
          <span className="text-sm font-medium text-brand dark:text-sage">{t('inviteSent')}</span>
        )}
        {status === 'exists' && (
          <span className="text-sm text-destructive">{t('inviteExists')}</span>
        )}
        {status === 'rate_limited' && (
          <span className="text-sm text-destructive">{t('inviteRateLimited')}</span>
        )}
        {status === 'error' && (
          <span className="text-sm text-destructive">{t('inviteError')}</span>
        )}
      </div>
    </section>
  )
}
