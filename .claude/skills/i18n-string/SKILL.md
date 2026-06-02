---
name: i18n-string
description: Use whenever adding, changing, or removing any user-facing text. Ensures every string exists in both pt-BR and en and that nothing is hardcoded.
---

# Adding or changing UI strings

Locales: `pt-BR` (default) and `en`. Catalogs: `messages/pt-BR.json`, `messages/en.json`.

Rules:
1. No hardcoded user-facing text in components. Route everything through next-intl (`useTranslations` / `getTranslations`).
2. Add the key to BOTH catalogs in the same change. A key in one but not the other is a bug.
3. Namespace keys by feature: `bets.placeBet`, `leaderboard.potTotal`, `auth.signIn`.
4. Format dates, numbers, and currency with next-intl formatters — never build them by hand. They must read correctly in pt-BR and en.
5. Team / country names come from the localized lookup, not inline literals.

## Checklist
- [ ] Key present in both catalogs
- [ ] No literal user-facing strings left in the component
- [ ] Dates / currency use locale-aware formatters
