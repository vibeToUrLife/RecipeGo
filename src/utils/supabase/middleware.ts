import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { roomToRestore } from '@/lib/last-collection'

const ROOM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: do not run code between createServerClient and getUser().
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublic = path.startsWith('/login') || path.startsWith('/auth')
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // A fresh visit to "/" goes back to the room used last (the last_collection
  // cookie), if still a member of it. That's decided here, before any of the
  // page is sent: decided in the page, after Next had started streaming it,
  // the redirect could only be a refresh of the whole page a moment later,
  // which slowed opening the app and cut its welcome animation short.
  if (user && path === '/') {
    const last = request.cookies.get('last_collection')?.value
    const home = request.nextUrl.searchParams.get('home') ?? undefined
    if (!home && last && ROOM_ID.test(last)) {
      const { data } = await supabase
        .from('room_members')
        .select('room_id')
        .eq('room_id', last)
        .eq('user_id', user.id)
        .maybeSingle()
      const room = roomToRestore(home, last, data ? [last] : [])
      if (room) {
        const url = request.nextUrl.clone()
        url.pathname = `/rooms/${room}`
        url.search = ''
        const redirect = NextResponse.redirect(url)
        // A session refreshed just now has to reach the browser this way too.
        supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
        return redirect
      }
    }
  }

  return supabaseResponse
}
