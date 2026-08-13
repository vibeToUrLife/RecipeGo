'use client'
import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useT } from '@/components/i18n-provider'

const emptySubscribe = () => () => {}

// Sun/Moon button that flips between light and dark. Renders a fixed icon until
// mounted so the server and first client render match (the theme is only known
// on the client). useSyncExternalStore reports "not mounted" during SSR and the
// hydration render, then "mounted" — hydration-safe with no setState in an effect.
export function ThemeToggle() {
  const t = useT()
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <button
      type="button"
      aria-label={t('theme.toggle')}
      title={t('theme.toggle')}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex items-center rounded-full border p-1.5 text-muted-foreground transition hover:text-foreground"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
