import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

// Locale-aware navigation. `usePathname` returns the path WITHOUT the locale
// prefix, and `useRouter().replace(path, { locale })` re-renders the current
// page in the target locale — the basis for the language switcher.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
