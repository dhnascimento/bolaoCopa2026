// Live FX rate from Frankfurter (https://www.frankfurter.app) — free, no API
// key, ECB-backed, covers BRL and CAD. Cached via Next's fetch revalidation
// (no cron): one upstream call at most every 6 hours, shared across requests.
//
// Returns null on any failure so callers can degrade gracefully (show the base
// currency only).
export async function getRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${from}&to=${to}`,
      { next: { revalidate: 21600 } }, // 6h — ECB updates ~once per business day
    )
    if (!res.ok) return null
    const data = (await res.json()) as { rates?: Record<string, number> }
    const rate = data.rates?.[to]
    return typeof rate === 'number' ? rate : null
  } catch {
    return null
  }
}
