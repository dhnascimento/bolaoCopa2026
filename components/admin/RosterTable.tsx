'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { setPaymentStatus } from '@/lib/admin/actions'

export type RosterProfile = {
  id: string
  display_name: string
  payment_admin_status: string
  payment_self_confirmed_at: string | null
  created_at: string
}

const STATUS_BADGE: Record<string, string> = {
  pending:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  confirmed:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function RosterTable({ profiles }: { profiles: RosterProfile[] }) {
  const t = useTranslations('admin')
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleSetStatus = (
    userId: string,
    status: 'pending' | 'confirmed' | 'rejected',
  ) => {
    setPendingUserId(userId)
    startTransition(async () => {
      await setPaymentStatus(userId, status)
      setPendingUserId(null)
    })
  }

  if (profiles.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('rosterEmpty')}</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-2 text-left font-medium">{t('rosterName')}</th>
            <th className="px-4 py-2 text-left font-medium">{t('rosterSelfConfirmed')}</th>
            <th className="px-4 py-2 text-left font-medium">{t('rosterPaymentStatus')}</th>
            <th className="px-4 py-2 text-right font-medium">{t('rosterActions')}</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile) => {
            const isLoading = pendingUserId === profile.id
            const status = profile.payment_admin_status as 'pending' | 'confirmed' | 'rejected'

            return (
              <tr key={profile.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{profile.display_name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {profile.payment_self_confirmed_at
                    ? new Date(profile.payment_self_confirmed_at).toLocaleDateString()
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      STATUS_BADGE[status] ?? STATUS_BADGE.pending
                    }`}
                  >
                    {t(`paymentStatus.${status}`)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {status !== 'confirmed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetStatus(profile.id, 'confirmed')}
                        disabled={isLoading}
                      >
                        {t('confirmPayment')}
                      </Button>
                    )}
                    {status === 'confirmed' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSetStatus(profile.id, 'pending')}
                        disabled={isLoading}
                      >
                        {t('revertPayment')}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
