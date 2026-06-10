// Tournament stage ordering, shared by the fixtures page and the client-side
// filter/grouping in FixturesBrowser.

export const STAGE_KEYS = ['group', 'r32', 'r16', 'qf', 'sf', '3rd', 'final'] as const
export type StageKey = (typeof STAGE_KEYS)[number]

export const STAGE_ORDER: Record<string, number> = {
  group: 0,
  r32: 1,
  r16: 2,
  qf: 3,
  sf: 4,
  '3rd': 5,
  final: 6,
}
