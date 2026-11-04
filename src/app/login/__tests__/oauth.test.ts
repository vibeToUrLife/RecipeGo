import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The real Supabase client builds the address Google sign-in goes to; only the
// request it reads (cookies, the origin) and Next's redirect are stood in for.
const jar = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => jar.set(name, value),
  }),
  headers: async () => new Headers({ origin: 'https://recipego.test' }),
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { url })
  },
}))

import { signInWithGoogle } from '@/app/login/oauth'

async function whereTo(): Promise<URL> {
  try {
    await signInWithGoogle()
  } catch (e) {
    return new URL((e as { url: string }).url)
  }
  throw new Error('signInWithGoogle did not redirect')
}

beforeEach(() => {
  jar.clear()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
})
afterEach(() => vi.unstubAllEnvs())

describe('signInWithGoogle', () => {
  it('has Google show its list of accounts, so someone who picked the wrong one can pick another', async () => {
    const url = await whereTo()
    expect(url.origin + url.pathname).toBe('https://db.example.supabase.co/auth/v1/authorize')
    expect(url.searchParams.get('provider')).toBe('google')
    expect(url.searchParams.get('prompt')).toBe('select_account')
  })

  it('still comes back to this site’s sign-in callback', async () => {
    const url = await whereTo()
    expect(url.searchParams.get('redirect_to')).toBe('https://recipego.test/auth/callback')
  })
})
