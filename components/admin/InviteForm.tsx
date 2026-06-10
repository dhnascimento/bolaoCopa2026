'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { inviteUser, createInviteLink } from '@/lib/admin/invite-actions'

type InviteStatus =
  | 'idle'
  | 'sent'
  | 'linkReady'
  | 'exists'
  | 'rate_limited'
  | 'error'

export default function InviteForm() {
  const t = useTranslations('admin')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [locale, setLocale] = useState('pt-BR')
  const [status, setStatus] = useState<InviteStatus>('idle')
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleCreateLink = () => {
    if (!email || !displayName) return
    setStatus('idle')
    setLink(null)
    setCopied(false)
    startTransition(async () => {
      const result = await createInviteLink(email.trim(), displayName.trim(), locale)
      if (result.success) {
        setLink(result.link)
        setStatus('linkReady')
        setEmail('')
        setDisplayName('')
      } else if (result.error === 'already_exists') {
        setStatus('exists')
      } else {
        setStatus('error')
      }
    })
  }

  const handleSendEmail = () => {
    if (!email || !displayName) return
    setStatus('idle')
    setLink(null)
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

  const handleCopy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard blocked — the admin can still select the text manually.
    }
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

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          onClick={handleCreateLink}
          disabled={!email || !displayName || isPending}
        >
          {isPending ? t('inviteCreatingLink') : t('inviteCreateLink')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSendEmail}
          disabled={!email || !displayName || isPending}
        >
          {t('inviteSend')}
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

      {status === 'linkReady' && link && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p className="text-sm font-medium text-brand dark:text-sage">{t('inviteLinkReady')}</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="sm" variant="outline" className="shrink-0" onClick={handleCopy}>
              {copied ? t('inviteCopied') : t('inviteCopy')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('inviteLinkHint')}</p>
        </div>
      )}
    </section>
  )
}
