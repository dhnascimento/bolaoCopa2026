import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/admin/AdminNav'
import MatchResultsForm, { type MatchRow } from '@/components/admin/MatchResultsForm'
import OutrightResultsForm, {
  type TeamOpt,
  type PlayerOpt,
} from '@/components/admin/OutrightResultsForm'

type NamedRel = { name: string } | { name: string }[] | null
function relName(v: NamedRel): string | null {
  const o = Array.isArray(v) ? v[0] : v
  return o?.name ?? null
}

export default async function AdminResultsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations('admin')
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/sign-in`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-muted-foreground">{t('notAdmin')}</p>
      </main>
    )
  }

  const [{ data: fixtures }, { data: settings }, { data: teams }, { data: players }] =
    await Promise.all([
      supabase
        .from('fixtures')
        .select(
          `id, kickoff_at, status, regulation_home, regulation_away,
           home_team:teams!fixtures_home_team_id_fkey(name),
           away_team:teams!fixtures_away_team_id_fkey(name)`,
        )
        .order('kickoff_at', { ascending: true }),
      supabase
        .from('settings')
        .select('actual_champion_team_id, actual_top_scorer_player_id')
        .single(),
      supabase.from('teams').select('id, name').order('name'),
      supabase.from('players').select('id, name, teams(name)').order('name'),
    ])

  const matchRows: MatchRow[] = (fixtures ?? []).map((f) => ({
    id: f.id,
    kickoff_at: f.kickoff_at,
    status: f.status,
    regulation_home: f.regulation_home,
    regulation_away: f.regulation_away,
    home: relName(f.home_team as NamedRel) ?? 'TBD',
    away: relName(f.away_team as NamedRel) ?? 'TBD',
  }))

  const playerOpts: PlayerOpt[] = (players ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    team: relName(p.teams as NamedRel),
  }))

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <AdminNav locale={locale} />
      <MatchResultsForm fixtures={matchRows} />
      <OutrightResultsForm
        teams={(teams ?? []) as TeamOpt[]}
        players={playerOpts}
        currentChampionId={settings?.actual_champion_team_id ?? null}
        currentTopScorerId={settings?.actual_top_scorer_player_id ?? null}
      />
    </main>
  )
}
