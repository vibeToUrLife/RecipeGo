'use client'
import { useRouter } from 'next/navigation'
import { useLocale, useT } from '@/components/i18n-provider'
import type { Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function LanguageSwitcher() {
  const locale = useLocale()
  const t = useT()
  const router = useRouter()

  function choose(next: Locale) {
    if (next === locale) return
    // 1 year; re-render server components so the new locale flows through.
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`
    router.refresh()
  }

  const base = 'px-2 py-0.5 text-xs transition'
  const active = 'bg-primary text-primary-foreground'
  const idle = 'text-muted-foreground hover:text-foreground'

  return (
    <div className="flex overflow-hidden rounded-full border" role="group" aria-label={t('lang.switcherLabel')}>
      <button type="button" onClick={() => choose('en')} className={cn(base, locale === 'en' ? active : idle)} aria-pressed={locale === 'en'}>
        EN
      </button>
      <button type="button" onClick={() => choose('zh')} className={cn(base, locale === 'zh' ? active : idle)} aria-pressed={locale === 'zh'}>
        中文
      </button>
    </div>
  )
}
