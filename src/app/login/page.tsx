import { login, signup } from './actions'
import { signInWithGoogle } from './oauth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const sp = await searchParams
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-3xl">🍳 RecipeGo</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in or create an account.</p>
        </CardHeader>
        <CardContent>
          {sp.error && (
            <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{sp.error}</p>
          )}
          {sp.message && (
            <p className="mb-3 rounded-md bg-secondary/15 px-3 py-2 text-sm text-secondary-foreground">{sp.message}</p>
          )}
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={6} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" formAction={login} className="flex-1">Log in</Button>
              <Button type="submit" formAction={signup} variant="secondary" className="flex-1">Sign up</Button>
            </div>
          </form>
          <form action={signInWithGoogle} className="mt-3">
            <Button type="submit" variant="outline" className="w-full">Continue with Google</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
