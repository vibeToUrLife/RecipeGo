'use client'
import { useEffect } from 'react'

// Persists which "collection" the user is viewing — a room id, or "personal" —
// so opening the site fresh returns them there (see src/app/page.tsx). Set
// client-side because server components can't write cookies; read server-side.
export function RememberCollection({ value }: { value: string }) {
  useEffect(() => {
    // UUID or the literal "personal" — no escaping needed. 1-year, path=/.
    document.cookie = `last_collection=${value}; path=/; max-age=31536000; samesite=lax`
  }, [value])
  return null
}
