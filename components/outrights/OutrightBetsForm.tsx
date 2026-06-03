'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { placeOutrightBet } from '@/lib/bets/outright-actions'

export type Team = { id: number; name: string; flag_url: string | null }
export type PlayerWithTeam = {
  id: number
  name: string
  teams: { name: string } | null
}
export type CurrentBet = {
  bet_type: string
  predicted_team_id: number | null
  predicted_player_id: number | null
}

type SaveStatus = 'idle' | 'saved' | 'error' | 'locked'

export default function OutrightBetsForm({
  teams,
  players,
  currentBets,
  registrationLockedAt,
}: {
  teams: Team[]
  players: PlayerWithTeam[]
  currentBets: CurrentBet[]
  registrationLockedAt: string | null
}) {
  const t = useTranslations('outrights')

  const initialChampionId =
    currentBets.find((b) => b.bet_type === 'champion')?.predicted_team_id ?? null
  const initialTopScorerId =
    currentBets.find((b) => b.bet_type === 'top_scorer')?.predicted_player_id ?? null

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(initialChampionId)
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(initialTopScorerId)
  const [playerQuery, setPlayerQuery] = useState('')
  const [showPlayerList, setShowPlayerList] = useState(false)

  const [isLocked, setIsLocked] = useState(() => {
    if (!registrationLockedAt) return false
    return Date.now() >= new Date(registrationLockedAt).getTime()
  })

  const [championStatus, setChampionStatus] = useState<SaveStatus>('idle')
  const [topScorerStatus, setTopScorerStatus] = useState<SaveStatus>('idle')
  const [isPendingChampion, startChampion] = useTransition()
  const [isPendingTopScorer, startTopScorer] = useTransition()

  const playerListRef = useRef<HTMLDivElement>(null)

  // Auto-lock when registration_locked_at arrives
  useEffect(() => {
    if (!registrationLockedAt || isLocked) return
    const delay = Math.max(0, new Date(registrationLockedAt).getTime() - Date.now())
    const id = setTimeout(() => setIsLocked(true), delay)
    return () => clearTimeout(id)
  }, [registrationLockedAt, isLocked])

  // Close player dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (playerListRef.current && !playerListRef.current.contains(e.target as Node)) {
        setShowPlayerList(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredPlayers =
    playerQuery.trim().length >= 2
      ? players
          .filter((p) => {
            const q = playerQuery.toLowerCase()
            return (
              p.name.toLowerCase().includes(q) ||
              (p.teams?.name ?? '').toLowerCase().includes(q)
            )
          })
          .slice(0, 15)
      : []

  const selectedTeam = teams.find((t) => t.id === selectedTeamId)
  const selectedPlayer = players.find((p) => p.id === selectedPlayerId)

  const handleSaveChampion = () => {
    if (!selectedTeamId) return
    setChampionStatus('idle')
    startChampion(async () => {
      const result = await placeOutrightBet('champion', selectedTeamId, null)
      if (result.success) {
        setChampionStatus('saved')
        setTimeout(() => setChampionStatus('idle'), 3000)
      } else if (result.error === 'locked') {
        setIsLocked(true)
        setChampionStatus('locked')
      } else {
        setChampionStatus('error')
      }
    })
  }

  const handleSaveTopScorer = () => {
    if (!selectedPlayerId) return
    setTopScorerStatus('idle')
    startTopScorer(async () => {
      const result = await placeOutrightBet('top_scorer', null, selectedPlayerId)
      if (result.success) {
        setTopScorerStatus('saved')
        setTimeout(() => setTopScorerStatus('idle'), 3000)
      } else if (result.error === 'locked') {
        setIsLocked(true)
        setTopScorerStatus('locked')
      } else {
        setTopScorerStatus('error')
      }
    })
  }

  const lockBadge = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isLocked
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isLocked ? 'bg-red-500' : 'bg-green-500'}`} />
      {isLocked ? t('locked') : t('open')}
    </span>
  )

  const statusText = (status: SaveStatus) => {
    if (status === 'saved') return <span className="text-sm text-green-600">{t('saved')}</span>
    if (status === 'locked') return <span className="text-sm text-destructive">{t('errorLocked')}</span>
    if (status === 'error') return <span className="text-sm text-destructive">{t('errorSave')}</span>
    return null
  }

  return (
    <div className="space-y-8">
      {/* Lock status */}
      <div className="flex items-center gap-2">{lockBadge}</div>

      {/* ── Champion ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t('champion')}</h2>

        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noTeams')}</p>
        ) : (
          <>
            {/* Current pick display */}
            <div className="text-sm text-muted-foreground">
              {t('yourPick')}:{' '}
              <span className="text-foreground font-medium">
                {selectedTeam ? selectedTeam.name : t('noPick')}
              </span>
            </div>

            {!isLocked && (
              <>
                <select
                  value={selectedTeamId ?? ''}
                  onChange={(e) =>
                    setSelectedTeamId(e.target.value ? Number(e.target.value) : null)
                  }
                  className="w-full max-w-xs rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">{t('pickTeam')}</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    onClick={handleSaveChampion}
                    disabled={!selectedTeamId || isPendingChampion}
                  >
                    {isPendingChampion ? t('saving') : t('save')}
                  </Button>
                  {statusText(championStatus)}
                </div>
              </>
            )}
          </>
        )}
      </section>

      {/* ── Top Scorer ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t('topScorer')}</h2>

        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noPlayers')}</p>
        ) : (
          <>
            {/* Current pick display */}
            <div className="text-sm text-muted-foreground">
              {t('yourPick')}:{' '}
              <span className="text-foreground font-medium">
                {selectedPlayer
                  ? `${selectedPlayer.name}${selectedPlayer.teams ? ` (${selectedPlayer.teams.name})` : ''}`
                  : t('noPick')}
              </span>
            </div>

            {!isLocked && (
              <>
                {/* Player search */}
                <div className="relative max-w-xs" ref={playerListRef}>
                  <input
                    type="text"
                    placeholder={t('pickPlayer')}
                    value={playerQuery}
                    onChange={(e) => {
                      setPlayerQuery(e.target.value)
                      setShowPlayerList(true)
                    }}
                    onFocus={() => setShowPlayerList(true)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />

                  {showPlayerList && filteredPlayers.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-md max-h-48 overflow-y-auto">
                      {filteredPlayers.map((player) => (
                        <button
                          key={player.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between gap-2"
                          onMouseDown={(e) => {
                            // Use mousedown so it fires before the blur/outside-click handler
                            e.preventDefault()
                            setSelectedPlayerId(player.id)
                            setPlayerQuery(player.name)
                            setShowPlayerList(false)
                          }}
                        >
                          <span>{player.name}</span>
                          {player.teams && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {player.teams.name}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    onClick={handleSaveTopScorer}
                    disabled={!selectedPlayerId || isPendingTopScorer}
                  >
                    {isPendingTopScorer ? t('saving') : t('save')}
                  </Button>
                  {statusText(topScorerStatus)}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}
