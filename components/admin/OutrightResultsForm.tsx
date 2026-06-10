'use client'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { setOutrightResults } from '@/lib/admin/actions'

export type TeamOpt = { id: number; name: string }
export type PlayerOpt = { id: number; name: string; team: string | null }

export default function OutrightResultsForm({
  teams,
  players,
  currentChampionId,
  currentTopScorerId,
}: {
  teams: TeamOpt[]
  players: PlayerOpt[]
  currentChampionId: number | null
  currentTopScorerId: number | null
}) {
  const t = useTranslations('admin')
  const [championId, setChampionId] = useState<number | null>(currentChampionId)
  const [topScorerId, setTopScorerId] = useState<number | null>(currentTopScorerId)
  const initialPlayer = players.find((p) => p.id === currentTopScorerId)
  const [playerQuery, setPlayerQuery] = useState(initialPlayer ? initialPlayer.name : '')
  const [showList, setShowList] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [isPending, startTransition] = useTransition()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        setShowList(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() => {
    const q = playerQuery.trim().toLowerCase()
    if (q.length < 2) return []
    return players
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) || (p.team ?? '').toLowerCase().includes(q),
      )
      .slice(0, 15)
  }, [players, playerQuery])

  const save = () => {
    setStatus('idle')
    startTransition(async () => {
      const r = await setOutrightResults(championId, topScorerId)
      if (r.success) {
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 3000)
      } else {
        setStatus('error')
      }
    })
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{t('resultsOutrightsTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('resultsOutrightsHint')}</p>
      </div>

      {/* Champion */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="champion_result">
          {t('resultsChampionLabel')}
        </label>
        <select
          id="champion_result"
          value={championId ?? ''}
          onChange={(e) => setChampionId(e.target.value ? Number(e.target.value) : null)}
          className="w-full max-w-xs cursor-pointer rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">{t('resultsNone')}</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>

      {/* Top scorer */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t('resultsTopScorerLabel')}</label>
        <div className="relative max-w-xs" ref={listRef}>
          <input
            type="text"
            placeholder={t('resultsPickPlayer')}
            value={playerQuery}
            onChange={(e) => {
              setPlayerQuery(e.target.value)
              setShowList(true)
              if (e.target.value.trim() === '') setTopScorerId(null)
            }}
            onFocus={() => setShowList(true)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {showList && filtered.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-background shadow-md">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setTopScorerId(p.id)
                    setPlayerQuery(p.name)
                    setShowList(false)
                  }}
                >
                  <span>{p.name}</span>
                  {p.team && (
                    <span className="shrink-0 text-xs text-muted-foreground">{p.team}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={isPending}>
          {isPending ? t('resultsSaving') : t('resultsSave')}
        </Button>
        {status === 'saved' && (
          <span className="text-sm font-medium text-brand dark:text-sage">{t('resultsSaved')}</span>
        )}
        {status === 'error' && (
          <span className="text-sm text-destructive">{t('resultsError')}</span>
        )}
      </div>
    </section>
  )
}
