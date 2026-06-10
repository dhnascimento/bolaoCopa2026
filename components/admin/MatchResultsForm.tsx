'use client'
import { useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { setMatchResult, clearMatchResult } from '@/lib/admin/actions'

export type MatchRow = {
  id: number
  kickoff_at: string
  status: string
  regulation_home: number | null
  regulation_away: number | null
  home: string
  away: string
}

function Row({ fixture }: { fixture: MatchRow }) {
  const t = useTranslations('admin')
  const [home, setHome] = useState(
    fixture.regulation_home != null ? String(fixture.regulation_home) : '',
  )
  const [away, setAway] = useState(
    fixture.regulation_away != null ? String(fixture.regulation_away) : '',
  )
  const [isFinished, setIsFinished] = useState(fixture.status === 'finished')
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [isPending, startTransition] = useTransition()

  const save = () => {
    const h = parseInt(home, 10)
    const a = parseInt(away, 10)
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return
    setStatus('idle')
    startTransition(async () => {
      const r = await setMatchResult(fixture.id, h, a)
      if (r.success) {
        setIsFinished(true)
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 2500)
      } else {
        setStatus('error')
      }
    })
  }

  const clear = () => {
    setStatus('idle')
    startTransition(async () => {
      const r = await clearMatchResult(fixture.id)
      if (r.success) {
        setIsFinished(false)
        setHome('')
        setAway('')
      } else {
        setStatus('error')
      }
    })
  }

  const kickoff = new Date(fixture.kickoff_at)

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">
          {fixture.home} <span className="text-muted-foreground">×</span> {fixture.away}
        </p>
        <p className="text-xs text-muted-foreground">
          {kickoff.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {isFinished && (
            <span className="ml-2 font-semibold text-brand dark:text-sage">
              {t('resultsFinishedBadge')}
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={30}
          value={home}
          onChange={(e) => {
            setHome(e.target.value)
            setStatus('idle')
          }}
          disabled={isPending}
          aria-label={`${fixture.home} score`}
          className="h-9 w-12 rounded-md border bg-background text-center text-sm font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <span className="text-muted-foreground">–</span>
        <input
          type="number"
          min={0}
          max={30}
          value={away}
          onChange={(e) => {
            setAway(e.target.value)
            setStatus('idle')
          }}
          disabled={isPending}
          aria-label={`${fixture.away} score`}
          className="h-9 w-12 rounded-md border bg-background text-center text-sm font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={isPending || home === '' || away === ''}>
          {isPending ? t('resultsSaving') : t('resultsSave')}
        </Button>
        {isFinished && (
          <Button size="sm" variant="ghost" onClick={clear} disabled={isPending}>
            {t('resultsClear')}
          </Button>
        )}
        {status === 'saved' && (
          <span className="text-xs font-medium text-brand dark:text-sage">{t('resultsSaved')}</span>
        )}
        {status === 'error' && (
          <span className="text-xs text-destructive">{t('resultsError')}</span>
        )}
      </div>
    </div>
  )
}

export default function MatchResultsForm({ fixtures }: { fixtures: MatchRow[] }) {
  const t = useTranslations('admin')
  const [now] = useState(() => Date.now()) // single snapshot — avoids react-hooks/purity
  const [filter, setFilter] = useState<'played' | 'all'>('played')

  const shown = useMemo(() => {
    if (filter === 'all') return fixtures
    return fixtures.filter(
      (f) => f.status === 'finished' || new Date(f.kickoff_at).getTime() <= now,
    )
  }, [fixtures, filter, now])

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t('resultsMatchesTitle')}</h2>
        <div className="inline-flex rounded-md border p-0.5">
          {(['played', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`cursor-pointer rounded px-2.5 py-0.5 font-heading text-xs font-semibold uppercase tracking-wide transition-colors ${
                filter === f
                  ? 'bg-brand text-brand-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(f === 'played' ? 'resultsFilterPlayed' : 'resultsFilterAll')}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('resultsNoMatches')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((f) => (
            <Row key={f.id} fixture={f} />
          ))}
        </div>
      )}
    </section>
  )
}
