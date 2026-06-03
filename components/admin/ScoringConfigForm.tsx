'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { updateScoringConfig, triggerRescore } from '@/lib/admin/actions'
import type { ScoringConfig } from '@/lib/admin/actions'

export default function ScoringConfigForm({
  initialConfig,
}: {
  initialConfig: ScoringConfig
}) {
  const t = useTranslations('admin')
  const [config, setConfig] = useState<ScoringConfig>(initialConfig)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [rescoreStatus, setRescoreStatus] = useState<'idle' | 'done' | 'error'>('idle')
  const [rescoreCount, setRescoreCount] = useState<number | null>(null)
  const [isPendingSave, startSave] = useTransition()
  const [isPendingRescore, startRescore] = useTransition()

  const handleSave = () => {
    setSaveStatus('idle')
    startSave(async () => {
      const result = await updateScoringConfig(config)
      setSaveStatus(result.success ? 'saved' : 'error')
      if (result.success) setTimeout(() => setSaveStatus('idle'), 3000)
    })
  }

  const handleRescore = () => {
    setRescoreStatus('idle')
    startRescore(async () => {
      const result = await triggerRescore()
      if (result.success) {
        setRescoreCount(result.count ?? 0)
        setRescoreStatus('done')
        setTimeout(() => setRescoreStatus('idle'), 5000)
      } else {
        setRescoreStatus('error')
      }
    })
  }

  const numField = (key: keyof ScoringConfig, label: string, step = 1) => (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm font-medium" htmlFor={key}>
        {label}
      </label>
      <input
        id={key}
        type="number"
        min={0}
        step={step}
        value={config[key] as number}
        onChange={(e) =>
          setConfig((c) => ({ ...c, [key]: Number(e.target.value) }))
        }
        className="w-20 rounded-md border bg-background px-3 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Scoring point values */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t('scoringConfig')}</h2>
        <div className="rounded-lg border p-4 space-y-3 max-w-sm">
          {numField('points_correct_result', t('pointsCorrectResult'))}
          {numField('points_exact_score_bonus', t('pointsExactBonus'))}
          {numField('points_correct_champion', t('pointsChampion'))}
          {numField('points_correct_top_scorer', t('pointsTopScorer'))}
        </div>
      </section>

      {/* Entry fee */}
      <section>
        <div className="rounded-lg border p-4 space-y-3 max-w-sm">
          {numField('entry_fee', t('entryFee'), 0.01)}
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium" htmlFor="currency">
              {t('currency')}
            </label>
            <input
              id="currency"
              type="text"
              maxLength={3}
              value={config.currency}
              onChange={(e) =>
                setConfig((c) => ({ ...c, currency: e.target.value.toUpperCase() }))
              }
              className="w-20 rounded-md border bg-background px-3 py-1.5 text-sm text-right uppercase outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </section>

      {/* Save action */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={isPendingSave}>
          {isPendingSave ? t('saving') : t('save')}
        </Button>
        {saveStatus === 'saved' && (
          <span className="text-sm text-green-600">{t('saved')}</span>
        )}
        {saveStatus === 'error' && (
          <span className="text-sm text-destructive">{t('saveError')}</span>
        )}
      </div>

      {/* Re-score section */}
      <div className="border-t pt-6 space-y-3">
        <p className="text-sm text-muted-foreground max-w-sm">
          Re-scores every finished match using the current point values above. Idempotent — safe to run multiple times.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={handleRescore} disabled={isPendingRescore}>
            {isPendingRescore ? t('rescoring') : t('rescore')}
          </Button>
          {rescoreStatus === 'done' && rescoreCount !== null && (
            <span className="text-sm text-green-600">
              {t('rescored', { count: rescoreCount })}
            </span>
          )}
          {rescoreStatus === 'error' && (
            <span className="text-sm text-destructive">{t('rescoreError')}</span>
          )}
        </div>
      </div>
    </div>
  )
}
