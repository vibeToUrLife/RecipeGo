'use client'
import { createContext, useContext } from 'react'
import { translate, type Locale } from '@/lib/i18n'

const LocaleContext = createContext<Locale>('en')

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useLocale(): Locale {
  return useContext(LocaleContext)
}

// Translator for client components.
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const locale = useContext(LocaleContext)
  return (key, vars) => translate(locale, key, vars)
}
