import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AuthCodeError() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl">Sign-in failed</h1>
      <p className="text-muted-foreground">We couldn't complete Google sign-in. Please try again.</p>
      <Button asChild><Link href="/login">Back to login</Link></Button>
    </main>
  )
}
