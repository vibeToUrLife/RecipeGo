'use client'
import { useEffect } from 'react'
import { useLocale } from '@/components/i18n-provider'
import { syncPush } from '@/lib/push-client'

// On every signed-in page: if notifications are on for this phone, the server's
// copy of its subscription is kept current (see syncPush). Usually that's
// nothing to do.
export function PushSync() {
  const locale = useLocale()
  useEffect(() => {
    syncPush(locale).catch((e) => console.warn('Could not update this phone’s notifications', e))
  }, [locale])
  return null
}
