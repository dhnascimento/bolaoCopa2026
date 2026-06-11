'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

export type LeaderboardRow = {
  user_id: string | null
  display_name: string | null
  is_bot: boolean | null
  points: number | null
  exact_hits: number | null
  correct_results: number | null
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
        1
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-700/60 dark:text-slate-300">
        2
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
        3
      </span>
    )
  }
  return <span className="text-muted-foreground tabular-nums pl-1">{rank}</span>
}

function assignRanks(rows: LeaderboardRow[]) {
  const ranks: number[] = []
  for (let i = 0; i < rows.length; i++) {
    if (i === 0) {
      ranks.push(1)
    } else {
      const prev = rows[i - 1]
      const curr = rows[i]
      if (
        curr.points === prev.points &&
        curr.exact_hits === prev.exact_hits &&
        curr.correct_results === prev.correct_results
      ) {
        ranks.push(ranks[i - 1])
      } else {
        ranks.push(i + 1)
      }
    }
  }
  return rows.map((r, i) => ({ ...r, rank: ranks[i] }))
}

export default function LeaderboardTable({
  initialData,
  currentUserId,
}: {
  initialData: LeaderboardRow[]
  currentUserId: string
}) {
  const t = useTranslations('leaderboard')
  const [data, setData] = useState(initialData)

  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout>

    const channel = supabase
      .channel('leaderboard-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'match_bets' },
        () => {
          // Debounce: scoring updates many rows in one transaction; wait for
          // the burst to settle before re-fetching the aggregated view.
          clearTimeout(timer)
          timer = setTimeout(async () => {
            const { data: fresh } = await supabase
              .from('leaderboard')
              .select('user_id, display_name, is_bot, points, exact_hits, correct_results')
            if (fresh) setData(fresh as LeaderboardRow[])
          }, 600)
        },
      )
      .subscribe()

    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [])

  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">{t('noEntries')}</p>
  }

  const ranked = assignRanks(data)

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <th className="w-9 py-3 pl-4 pr-3 text-left sm:pl-6">{t('rank')}</th>
              <th className="py-3 pr-3 text-left">{/* display name — no header */}</th>
              <th className="py-3 pr-4 text-right font-medium sm:pr-3">{t('points')}</th>
              <th className="hidden py-3 pr-3 text-right sm:table-cell">{t('exactHits')}</th>
              <th className="hidden py-3 pr-4 text-right sm:table-cell sm:pr-6">{t('correctResults')}</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row) => {
              const isMe = row.user_id === currentUserId
              return (
                <tr
                  key={row.user_id}
                  className={`border-b last:border-0 ${isMe ? 'bg-brand/5 dark:bg-brand/15' : ''}`}
                >
                  <td className="w-9 py-3 pl-4 pr-3 sm:pl-6">
                    <RankBadge rank={row.rank} />
                  </td>
                  <td className="py-3 pr-3">
                    <span className={isMe ? 'font-semibold' : ''}>
                      {row.display_name ?? '—'}
                    </span>
                    {row.is_bot && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground align-middle">
                        🤖 {t('bot')}
                      </span>
                    )}
                    {isMe && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {t('you')}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right font-bold tabular-nums text-brand dark:text-sage sm:pr-3">
                    {row.points ?? 0}
                  </td>
                  <td className="hidden py-3 pr-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                    {row.exact_hits ?? 0}
                  </td>
                  <td className="hidden py-3 pr-4 text-right tabular-nums text-muted-foreground sm:table-cell sm:pr-6">
                    {row.correct_results ?? 0}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
