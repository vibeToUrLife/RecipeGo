import 'server-only'
import { cookies, headers } from 'next/headers'
import { detectLocale, translate, type Locale } from '@/lib/i18n'

// Resolve the active locale: explicit cookie wins, else detect from the
// browser's Accept-Language header.
export async function getLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get('locale')?.value
  if (cookieLocale === 'en' || cookieLocale === 'zh') return cookieLocale
  return detectLocale((await headers()).get('accept-language'))
}

// Translator for server components.
export async function getT(): Promise<(key: string, vars?: Record<string, string | number>) => string> {
  const locale = await getLocale()
  return (key, vars) => translate(locale, key, vars)
}
