import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

// Static files skip the login check: images; the web app manifest, which a
// phone fetches without your login when RecipeGo is added to its home screen;
// and the service worker, which the browser re-fetches on its own to update it.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
