'use server'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export async function signInWithGoogle() {
  const supabase = await createClient()
  const origin = (await headers()).get('origin')!
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
      // Google otherwise signs you straight back in with the account you used
      // last, so someone who picked the wrong one could never pick another.
      // This has it show its list of accounts (and "Use another account") every
      // time.
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error) redirect('/auth/auth-code-error')
  if (data.url) redirect(data.url)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
