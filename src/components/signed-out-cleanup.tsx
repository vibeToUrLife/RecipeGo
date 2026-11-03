'use client'
import { useEffect } from 'react'
import { forgetOfflineLists } from '@/lib/offline-list'
import { dropPush } from '@/lib/push-client'

// On the login page no one's signed in (signing out lands here too), so what
// this phone held for the last account goes: the shopping lists it kept for
// opening offline, and its notifications.
export function SignedOutCleanup() {
  useEffect(() => {
    forgetOfflineLists()
    dropPush().catch(() => {})
  }, [])
  return null
}
