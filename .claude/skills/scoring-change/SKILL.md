---
name: scoring-change
description: Use when modifying the scoring engine, points calculation, or how match/outright results award points. Protects the idempotency invariant.
---

# Changing scoring logic

The scorer runs repeatedly (after every poll). It must be safe to run any number of times.

Rules:
1. Compute by assignment: `points_awarded = computePoints(bet, fixture, config)`. NEVER `+=` or otherwise accumulate.
2. Score on the regulation (90-minute) result only. Extra time and penalties do not change the score used for points.
3. Read every point value from the runtime config (`settings`), never hardcode — admins change these in-app.
4. A fixture contributes only when `status = 'finished'` and its regulation score is recorded.
5. Outright bets (champion, top scorer) are scored separately, only once their outcome is known.
6. The scorer connects with the service-role client (bypasses RLS). Never expose that client to the browser.

## Idempotency test (required before done)
Run the scorer twice in a row against a fixed set of finished fixtures. Totals must be identical after run 1 and run 2.

## Checklist
- [ ] No `+=` on points anywhere
- [ ] Point values read from runtime config
- [ ] Two consecutive runs produce identical totals
