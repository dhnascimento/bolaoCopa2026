'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

export type LeaderboardRow = {
  user_id: string | null
  display_name: string | null
  points: number | null
  exact_hits: number | null
  correct_results: number | null
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
              .select('user_id, display_name, points, exact_hits, correct_results')
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
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground text-xs">
            <th className="pb-2 pr-3 text-left w-7">{t('rank')}</th>
            <th className="pb-2 pr-3 text-left">{/* display name — no header */}</th>
            <th className="pb-2 pr-3 text-right font-medium">{t('points')}</th>
            <th className="pb-2 pr-3 text-right hidden sm:table-cell">{t('exactHits')}</th>
            <th className="pb-2 text-right hidden sm:table-cell">{t('correctResults')}</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((row) => {
            const isMe = row.user_id === currentUserId
            return (
              <tr
                key={row.user_id}
                className={`border-b last:border-0 ${isMe ? 'bg-muted/40' : ''}`}
              >
                <td className="py-3 pr-3 text-muted-foreground tabular-nums w-7">
                  {row.rank}
                </td>
                <td className="py-3 pr-3">
                  <span className={isMe ? 'font-semibold' : ''}>
                    {row.display_name ?? '—'}
                  </span>
                  {isMe && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {t('you')}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-3 text-right tabular-nums font-medium">
                  {row.points ?? 0}
                </td>
                <td className="py-3 pr-3 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                  {row.exact_hits ?? 0}
                </td>
                <td className="py-3 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                  {row.correct_results ?? 0}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
