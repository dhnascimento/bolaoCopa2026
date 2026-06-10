import { getTranslations } from 'next-intl/server'

export type RevealPick = {
  user_id: string
  display_name: string
  pick: string
}

function PickList({
  picks,
  currentUserId,
  youLabel,
  emptyLabel,
}: {
  picks: RevealPick[]
  currentUserId: string
  youLabel: string
  emptyLabel: string
}) {
  if (picks.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }
  return (
    <div className="space-y-1">
      {picks.map((p) => {
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
                  {youLabel}
                </span>
              )}
            </span>
            <span className="shrink-0 text-muted-foreground">{p.pick}</span>
          </div>
        )
      })}
    </div>
  )
}

// Shown on the outrights page only after registration locks. RLS already makes
// every participant's outright_bets row readable at that point.
export default async function OutrightsReveal({
  championPicks,
  topScorerPicks,
  currentUserId,
}: {
  championPicks: RevealPick[]
  topScorerPicks: RevealPick[]
  currentUserId: string
}) {
  const t = await getTranslations('outrights')
  const tl = await getTranslations('leaderboard')

  return (
    <section className="space-y-6 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-bold">{t('allPicks')}</h2>

      <div className="space-y-2">
        <h3 className="text-sm text-muted-foreground">{t('champion')}</h3>
        <PickList
          picks={championPicks}
          currentUserId={currentUserId}
          youLabel={tl('you')}
          emptyLabel={t('noPicks')}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm text-muted-foreground">{t('topScorer')}</h3>
        <PickList
          picks={topScorerPicks}
          currentUserId={currentUserId}
          youLabel={tl('you')}
          emptyLabel={t('noPicks')}
        />
      </div>
    </section>
  )
}
