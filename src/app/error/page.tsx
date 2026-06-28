import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function ErrorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl">Something went wrong</h1>
      <p className="text-muted-foreground">Please check your details and try again.</p>
      <Button asChild><Link href="/login">Back to login</Link></Button>
    </main>
  )
}
