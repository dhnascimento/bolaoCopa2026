import { defineRouting } from 'next-intl/routing'

// NOTE: next-intl's setup API moves between major versions.
// Verify this against the current next-intl docs when you install it.
export const routing = defineRouting({
  locales: ['pt-BR', 'en'],
  defaultLocale: 'pt-BR',
})
