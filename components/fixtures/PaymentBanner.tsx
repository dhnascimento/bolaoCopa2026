'use client'
import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { selfConfirmPayment } from '@/lib/payment/actions'

export default function PaymentBanner() {
  const t = useTranslations('payment')
  const [isPending, startTransition] = useTransition()

  const handleConfirm = () => {
    startTransition(async () => {
      await selfConfirmPayment()
    })
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm dark:border-amber-700 dark:bg-amber-950/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {t('bannerTitle')}
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-300">{t('bannerDesc')}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 border-amber-400 text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900/40"
          onClick={handleConfirm}
          disabled={isPending}
        >
          {isPending ? t('confirming') : t('confirmButton')}
        </Button>
      </div>
    </div>
  )
}
