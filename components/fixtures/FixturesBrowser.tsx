'use client'
import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  FixtureCard,
  type FixtureWithTeams,
  type UserBet,
} from './FixtureCard'
import { STAGE_KEYS, STAGE_ORDER, type StageKey } from '@/lib/fixtures/stages'

type View = 'upcoming' | 'past' | 'all'

const selectClass =
  'cursor-pointer rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring'

// Local date key (YYYY-MM-DD) for an ISO timestamp, in the viewer's timezone.
function dateKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function FixturesBrowser({
  fixtures,
  bets,
  currentUserId,
}: {
  fixtures: FixtureWithTeams[]
  bets: UserBet[]
  currentUserId: string
}) {
  const t = useTranslations('fixtures')
  const locale = useLocale()

  // Single time snapshot — keeps Date.now() out of render (react-hooks/purity).
  const [now] = useState(() => Date.now())

  const [view, setView] = useState<View>('upcoming')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [stage, setStage] = useState<'all' | StageKey>('all')
  const [group, setGroup] = useState<'all' | string>('all')
  const [date, setDate] = useState<'all' | string>('all')
  const [pendingOnly, setPendingOnly] = useState(false)

  const betsMap = useMemo(
    () => new Map(bets.map((b) => [b.fixture_id, b])),
    [bets],
  )

  const stageName = (s: string): string =>
    STAGE_KEYS.includes(s as StageKey) ? t(`stages.${s as StageKey}`) : s

  // Per-fixture flags derived from the single `now` snapshot.
  const flagged = useMemo(
    () =>
      fixtures.map((f) => {
        const kickoff = new Date(f.kickoff_at).getTime()
        const lock = new Date(f.lock_at).getTime()
        const isPast = f.status === 'finished' || kickoff < now
        const isLocked = now >= lock
        const hasBet = betsMap.has(f.id)
        return { f, isPast, isPending: !isLocked && !hasBet }
      }),
    [fixtures, betsMap, now],
  )

  // Fixtures within the current Past/Upcoming/All view (before the other
  // refinements) — drives which stage/group/date options are offered.
  const inView = useMemo(
    () =>
      flagged.filter(({ isPast }) =>
        view === 'all' ? true : view === 'past' ? isPast : !isPast,
      ),
    [flagged, view],
  )

  const availableStages = useMemo(() => {
    const set = new Set(inView.map(({ f }) => f.stage))
    return Array.from(set).sort(
      (a, b) => (STAGE_ORDER[a] ?? 99) - (STAGE_ORDER[b] ?? 99),
    )
  }, [inView])

  const availableGroups = useMemo(() => {
    const set = new Set(
      inView
        .map(({ f }) => f.group_label)
        .filter((g): g is string => g != null),
    )
    return Array.from(set).sort()
  }, [inView])

  const availableDates = useMemo(() => {
    const set = new Set(inView.map(({ f }) => dateKey(f.kickoff_at)))
    return Array.from(set).sort()
  }, [inView])

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
    [locale],
  )
  const formatDate = (key: string) => dateFormatter.format(new Date(`${key}T12:00:00`))

  // Final filtered + stage-grouped result.
  const grouped = useMemo(() => {
    const filtered = inView.filter(({ f, isPending }) => {
      if (stage !== 'all' && f.stage !== stage) return false
      if (group !== 'all' && f.group_label !== group) return false
      if (date !== 'all' && dateKey(f.kickoff_at) !== date) return false
      if (pendingOnly && view !== 'past' && !isPending) return false
      return true
    })

    const dir = sortOrder === 'asc' ? 1 : -1

    const map = new Map<string, FixtureWithTeams[]>()
    for (const { f } of filtered) {
      if (!map.has(f.stage)) map.set(f.stage, [])
      map.get(f.stage)!.push(f)
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          dir *
          (new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()),
      )
    }
    return Array.from(map.entries()).sort(
      ([a], [b]) => dir * ((STAGE_ORDER[a] ?? 99) - (STAGE_ORDER[b] ?? 99)),
    )
  }, [inView, stage, group, date, pendingOnly, view, sortOrder])

  const filtersActive =
    stage !== 'all' || group !== 'all' || date !== 'all' || pendingOnly

  const clearFilters = () => {
    setStage('all')
    setGroup('all')
    setDate('all')
    setPendingOnly(false)
  }

  const views: View[] = ['upcoming', 'past', 'all']

  if (fixtures.length === 0) {
    return <p className="text-muted-foreground">{t('noFixtures')}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filter bar */}
      <div className="flex flex-col gap-3">
        {/* Past / Upcoming / All segmented toggle */}
        <div className="inline-flex w-fit rounded-md border p-0.5">
          {views.map((v) => {
            const isActive = view === v
            return (
              <button
                key={v}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setView(v)
                  // Reset refinements whose options may no longer apply.
                  setStage('all')
                  setGroup('all')
                  setDate('all')
                  if (v === 'past') setPendingOnly(false)
                }}
                className={`cursor-pointer rounded px-3 py-1 font-heading text-xs font-semibold italic uppercase tracking-wide transition-colors ${
                  isActive
                    ? 'bg-brand text-brand-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(`filters.${v}`)}
              </button>
            )
          })}
        </div>

        {/* Dropdown refinements */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label={t('sort.label')}
            className="inline-flex w-fit rounded-md border p-0.5"
          >
            {(['asc', 'desc'] as const).map((o) => {
              const isActive = sortOrder === o
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setSortOrder(o)}
                  className={`cursor-pointer rounded px-3 py-1 font-heading text-xs font-semibold italic uppercase tracking-wide transition-colors ${
                    isActive
                      ? 'bg-brand text-brand-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t(o === 'asc' ? 'sort.oldest' : 'sort.newest')}
                </button>
              )
            })}
          </div>

          <select
            aria-label={t('filters.stage')}
            value={stage}
            onChange={(e) => setStage(e.target.value as 'all' | StageKey)}
            className={selectClass}
          >
            <option value="all">{t('filters.allStages')}</option>
            {availableStages.map((s) => (
              <option key={s} value={s}>
                {stageName(s)}
              </option>
            ))}
          </select>

          {availableGroups.length > 0 && (
            <select
              aria-label={t('filters.group')}
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className={selectClass}
            >
              <option value="all">{t('filters.allGroups')}</option>
              {availableGroups.map((g) => (
                <option key={g} value={g}>
                  {t('filters.groupLabel', { letter: g })}
                </option>
              ))}
            </select>
          )}

          <select
            aria-label={t('filters.date')}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={selectClass}
          >
            <option value="all">{t('filters.allDates')}</option>
            {availableDates.map((d) => (
              <option key={d} value={d}>
                {formatDate(d)}
              </option>
            ))}
          </select>

          {view !== 'past' && (
            <label className="flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm select-none">
              <input
                type="checkbox"
                checked={pendingOnly}
                onChange={(e) => setPendingOnly(e.target.checked)}
                className="cursor-pointer accent-primary"
              />
              {t('filters.pendingOnly')}
            </label>
          )}

          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="cursor-pointer text-sm font-medium text-primary hover:underline"
            >
              {t('filters.clear')}
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {grouped.length === 0 ? (
        <p className="text-muted-foreground">{t('filters.noMatches')}</p>
      ) : (
        grouped.map(([s, list]) => (
          <section key={s}>
            <h2 className="mb-3 not-italic normal-case tracking-normal">
              <span className="inline-block rounded-md bg-brand px-3 py-1 font-heading text-xs font-semibold italic uppercase tracking-wide text-brand-foreground">
                {stageName(s)}
              </span>
            </h2>
            <div className="flex flex-col gap-3">
              {list.map((fixture) => (
                <FixtureCard
                  key={fixture.id}
                  fixture={fixture}
                  existingBet={betsMap.get(fixture.id) ?? null}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
