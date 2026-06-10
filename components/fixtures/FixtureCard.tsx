'use client'
import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { placeBet } from '@/lib/bets/actions'
import { createClient } from '@/lib/supabase/client'
import { LockCountdown } from './LockCountdown'
import { Button } from '@/components/ui/button'

export type Team = {
  id: number
  name: string
  flag_url: string | null
}

export type FixtureWithTeams = {
  id: number
  stage: string
  group_label: string | null
  kickoff_at: string
  lock_at: string
  status: string
  home_score: number | null
  away_score: number | null
  home_team: Team | null
  away_team: Team | null
  odds_home: number | null
  odds_draw: number | null
  odds_away: number | null
}

export type UserBet = {
  fixture_id: number
  predicted_home: number
  predicted_away: number
}

type Prediction = {
  user_id: string
  predicted_home: number
  predicted_away: number
  display_name: string
}

export function FixtureCard({
  fixture,
  existingBet,
  currentUserId,
}: {
  fixture: FixtureWithTeams
  existingBet: UserBet | null
  currentUserId: string
}) {
  const tb = useTranslations('bets')
  const tl = useTranslations('leaderboard')

  const [isLocked, setIsLocked] = useState(
    () => new Date() >= new Date(fixture.lock_at),
  )
  const [home, setHome] = useState(
    existingBet != null ? String(existingBet.predicted_home) : '',
  )
  const [away, setAway] = useState(
    existingBet != null ? String(existingBet.predicted_away) : '',
  )
  const [savedBet, setSavedBet] = useState<{ home: number; away: number } | null>(
    existingBet != null
      ? { home: existingBet.predicted_home, away: existingBet.predicted_away }
      : null,
  )
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error-locked' | 'error'>('idle')
  const [isPending, startTransition] = useTransition()

  // Other participants' predictions — lazy-loaded on first expand. RLS only
  // returns other users' rows once the fixture has locked, so this is self-
  // protecting: an unlocked fixture would return just the current user's bet.
  const [showPredictions, setShowPredictions] = useState(false)
  const [predictions, setPredictions] = useState<Prediction[] | null>(null)
  const [loadingPredictions, setLoadingPredictions] = useState(false)

  const togglePredictions = () => {
    const next = !showPredictions
    setShowPredictions(next)
    if (!next || predictions !== null || loadingPredictions) return
    setLoadingPredictions(true)
    void (async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('match_bets')
        .select('user_id, predicted_home, predicted_away, profiles(display_name)')
        .eq('fixture_id', fixture.id)
      const rows: Prediction[] = (data ?? []).map((r) => {
        const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
        return {
          user_id: r.user_id,
          predicted_home: r.predicted_home,
          predicted_away: r.predicted_away,
          display_name: prof?.display_name ?? '—',
        }
      })
      rows.sort((a, b) => {
        if (a.user_id === currentUserId) return -1
        if (b.user_id === currentUserId) return 1
        return a.display_name.localeCompare(b.display_name)
      })
      setPredictions(rows)
      setLoadingPredictions(false)
    })()
  }

  useEffect(() => {
    const delay = Math.max(0, new Date(fixture.lock_at).getTime() - Date.now())
    const id = setTimeout(() => setIsLocked(true), delay)
    return () => clearTimeout(id)
  }, [fixture.lock_at])

  const handleSave = () => {
    const h = parseInt(home, 10)
    const a = parseInt(away, 10)
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return

    startTransition(async () => {
      const result = await placeBet(fixture.id, h, a)
      if (result.success) {
        setSavedBet({ home: h, away: a })
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2500)
      } else {
        setSaveStatus(result.error === 'locked' ? 'error-locked' : 'error')
        if (result.error === 'locked') setIsLocked(true)
      }
    })
  }

  const isSaving = isPending
  const homeTeam = fixture.home_team
  const awayTeam = fixture.away_team
  const kickoff = new Date(fixture.kickoff_at)

  const currentBet = savedBet

  const [initialMsToLock] = useState(
    () => new Date(fixture.lock_at).getTime() - new Date().getTime(),
  )
  const accentClass = isLocked
    ? 'border-l-4 border-l-primary'
    : initialMsToLock < 60 * 60 * 1000
      ? 'border-l-4 border-l-amber-400 dark:border-l-amber-500'
      : 'border-l-4 border-l-brand'

  return (
    <div className={`rounded-xl border bg-card p-4 flex flex-col gap-3 shadow-sm ${accentClass}`}>
      {/* Teams + score row */}
      <div className="flex items-center gap-3">
        {/* Home team */}
        <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
          {homeTeam?.flag_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={homeTeam.flag_url}
              alt=""
              width={36}
              height={27}
              className="rounded object-cover"
            />
          )}
          <span className="text-sm font-semibold text-center leading-tight line-clamp-2 w-full">
            {homeTeam?.name ?? <span className="text-muted-foreground">TBD</span>}
          </span>
        </div>

        {/* Score inputs or display */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isLocked ? (
            <div className="flex items-center gap-1 text-2xl font-bold tabular-nums">
              {currentBet != null ? (
                <>
                  <span>{currentBet.home}</span>
                  <span className="text-muted-foreground text-base">–</span>
                  <span>{currentBet.away}</span>
                </>
              ) : (
                <span className="text-sm font-normal text-muted-foreground">
                  {tb('noBet')}
                </span>
              )}
            </div>
          ) : (
            <>
              <input
                type="number"
                min={0}
                max={20}
                value={home}
                onChange={(e) => {
                  setHome(e.target.value)
                  setSaveStatus('idle')
                }}
                disabled={isSaving}
                aria-label="Home score"
                className="w-11 h-11 text-center text-xl font-bold rounded-lg border bg-background tabular-nums focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
              <span className="text-muted-foreground font-bold">–</span>
              <input
                type="number"
                min={0}
                max={20}
                value={away}
                onChange={(e) => {
                  setAway(e.target.value)
                  setSaveStatus('idle')
                }}
                disabled={isSaving}
                aria-label="Away score"
                className="w-11 h-11 text-center text-xl font-bold rounded-lg border bg-background tabular-nums focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </>
          )}
        </div>

        {/* Away team */}
        <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
          {awayTeam?.flag_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={awayTeam.flag_url}
              alt=""
              width={36}
              height={27}
              className="rounded object-cover"
            />
          )}
          <span className="text-sm font-semibold text-center leading-tight line-clamp-2 w-full">
            {awayTeam?.name ?? <span className="text-muted-foreground">TBD</span>}
          </span>
        </div>
      </div>

      {/* Kickoff + lock status row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {kickoff.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        {isLocked ? (
          <span className="text-xs font-medium text-muted-foreground">{tb('locked')}</span>
        ) : (
          <LockCountdown lockAt={fixture.lock_at} />
        )}
      </div>

      {/* Odds row (pre-match, only when available) */}
      {fixture.odds_home != null &&
        fixture.odds_draw != null &&
        fixture.odds_away != null && (
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>
              1 <span className="font-medium text-foreground tabular-nums">{fixture.odds_home.toFixed(2)}</span>
            </span>
            <span>
              X <span className="font-medium text-foreground tabular-nums">{fixture.odds_draw.toFixed(2)}</span>
            </span>
            <span>
              2 <span className="font-medium text-foreground tabular-nums">{fixture.odds_away.toFixed(2)}</span>
            </span>
          </div>
        )}

      {/* Save button + error (only when unlocked) */}
      {!isLocked && (
        <div className="flex flex-col gap-1">
          <Button
            onClick={handleSave}
            disabled={isSaving || home === '' || away === ''}
            size="sm"
            className="w-full"
            variant={saveStatus === 'saved' ? 'outline' : 'default'}
          >
            {isSaving
              ? tb('saving')
              : saveStatus === 'saved'
                ? tb('saved')
                : tb('placeBet')}
          </Button>
          {(saveStatus === 'error-locked' || saveStatus === 'error') && (
            <p className="text-xs text-destructive text-center">
              {saveStatus === 'error-locked' ? tb('errorLocked') : tb('errorSave')}
            </p>
          )}
        </div>
      )}

      {/* All participants' predictions — only once the fixture is locked */}
      {isLocked && (
        <div className="border-t pt-3">
          <button
            type="button"
            onClick={togglePredictions}
            aria-expanded={showPredictions}
            className="cursor-pointer font-heading text-xs font-semibold italic uppercase tracking-wide text-brand transition-colors hover:text-primary dark:text-sage"
          >
            {showPredictions ? tb('hidePredictions') : tb('viewPredictions')}
          </button>

          {showPredictions && (
            <div className="mt-2 space-y-1">
              {loadingPredictions && (
                <p className="text-xs text-muted-foreground">{tb('loadingPredictions')}</p>
              )}
              {!loadingPredictions && predictions?.length === 0 && (
                <p className="text-xs text-muted-foreground">{tb('noPredictions')}</p>
              )}
              {!loadingPredictions &&
                predictions?.map((p) => {
                  const isMe = p.user_id === currentUserId
                  return (
                    <div
                      key={p.user_id}
                      className={`flex items-center justify-between gap-2 text-sm ${
                        isMe ? 'font-semibold text-brand dark:text-sage' : ''
                      }`}
                    >
                      <span className="truncate">
                        {p.display_name}
                        {isMe && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            {tl('you')}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {p.predicted_home}–{p.predicted_away}
                      </span>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
