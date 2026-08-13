'use client'
import { useT } from '@/components/i18n-provider'

// Skeletons are aria-hidden decoration; this is the bit assistive tech actually
// announces. It's a client component so it can be translated — a `loading.tsx`
// fallback must never suspend, so it can't `await getT()` itself.
export function LoadingLabel() {
  const t = useT()
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {t('common.loading')}
    </span>
  )
}
