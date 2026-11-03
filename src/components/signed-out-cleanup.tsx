'use client'
import { useEffect } from 'react'
import { forgetOfflineLists } from '@/lib/offline-list'

// On the login page no one's signed in, so the shopping lists this phone kept
// for opening offline go (signing out lands here too).
export function ForgetOfflineLists() {
  useEffect(() => {
    forgetOfflineLists()
  }, [])
  return null
}
