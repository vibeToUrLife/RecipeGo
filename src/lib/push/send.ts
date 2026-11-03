import 'server-only'
import { after } from 'next/server'
import webpush from 'web-push'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { LOCALES, translate, type Locale } from '@/lib/i18n'
import { noticeGroup, roomNotice, type Notice, type RoomChange } from '@/lib/push/messages'

// Telling a room's other members, on their phones, what someone changed there.
//
// It takes three secrets on the server and does nothing until all are set:
// the VAPID key pair that push services check each notification against (the
// public half, NEXT_PUBLIC_VAPID_PUBLIC_KEY, is also what phones subscribe
// with), and the Supabase service role key, to save subscriptions and read the
// other members', which RLS keeps from everyone but the server and their owner.

const QUIET_MS = 5 * 60_000 // a run of changes by one member notifies once in this long
const TTL_S = 12 * 60 * 60 // a notification a phone can't get within 12 hours is dropped

type Config = {
  vapid: { subject: string; publicKey: string; privateKey: string }
  url: string
  serviceKey: string
}

function config(): Config | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Who push services can contact about these notifications: VAPID_SUBJECT
  // (a mailto: address) if set, otherwise the site itself, which Vercel names.
  const site = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const subject = process.env.VAPID_SUBJECT || (site ? `https://${site}` : '')
  if (!publicKey || !privateKey || !serviceKey || !url || !subject) return null
  if (!vapidLooksRight(publicKey, privateKey, subject)) {
    console.error('Notifications are off: the VAPID keys or VAPID_SUBJECT are not in the right form (see SETUP.md).')
    return null
  }
  return { vapid: { subject, publicKey, privateKey }, url, serviceKey }
}

// The pair from `npx web-push generate-vapid-keys` (a P-256 public key and its
// 32-byte private key), and a mailto: or https: contact. Anything else, a
// placeholder say, would only make every notification fail.
const base64url = /^[A-Za-z0-9_-]+$/
function vapidLooksRight(publicKey: string, privateKey: string, subject: string): boolean {
  if (!base64url.test(publicKey) || !base64url.test(privateKey)) return false
  const pub = Buffer.from(publicKey, 'base64url')
  return pub.length === 65 && pub[0] === 4 && Buffer.from(privateKey, 'base64url').length === 32
    && /^(mailto:\S+@\S+|https:\/\/\S+)$/.test(subject)
}

export const pushConfigured = (): boolean => config() !== null

// The service role client: past RLS, so used only for the two tables here.
const admin = (cfg: Config) =>
  createSupabaseClient(cfg.url, cfg.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

// The push services the server will send to. A subscription's address is where
// the server POSTs, so one anywhere else isn't saved, or sent to.
const PUSH_HOSTS = ['.googleapis.com', '.mozilla.com', '.push.apple.com', '.notify.windows.com']
export function isPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false
  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' && !url.port && !url.username && !url.password
      && PUSH_HOSTS.some((host) => `.${url.hostname}`.endsWith(host))
  } catch {
    return false
  }
}

type Subscription = { endpoint: string; p256dh: string; auth: string; locale: Locale }

// A subscription as a browser hands it over (PushSubscription.toJSON()), checked:
// a real push service's address, and keys of the right shape (an uncompressed
// P-256 public key, and a 16-byte secret).
function parseSubscription(input: unknown): Omit<Subscription, 'locale'> | null {
  const sub = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null
  const bytes = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9_-]+={0,2}$/.test(v) ? Buffer.from(v, 'base64url') : null)
  const p256dh = bytes(sub?.keys?.p256dh)
  const auth = bytes(sub?.keys?.auth)
  if (!sub || !isPushEndpoint(sub.endpoint) || p256dh?.length !== 65 || p256dh[0] !== 4 || auth?.length !== 16) return null
  return { endpoint: sub.endpoint, p256dh: sub.keys!.p256dh as string, auth: sub.keys!.auth as string }
}

const asLocale = (v: unknown): Locale => (LOCALES.includes(v as Locale) ? (v as Locale) : 'en')

export type SaveResult = 'saved' | 'invalid' | 'signed-out' | 'not-configured' | 'failed'

// Saves this phone's subscription as the signed-in user's. Saved by its
// address, so a phone signed into another account before is handed over.
export async function saveSubscription(input: unknown, locale: unknown): Promise<SaveResult> {
  const cfg = config()
  if (!cfg) return 'not-configured'
  const sub = parseSubscription(input)
  if (!sub) return 'invalid'
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  if (!user) return 'signed-out'
  const { error } = await admin(cfg)
    .from('push_subscriptions')
    .upsert({ ...sub, user_id: user.id, locale: asLocale(locale) }, { onConflict: 'endpoint' })
  if (error) {
    console.error('Could not save a push subscription', error)
    return 'failed'
  }
  return 'saved'
}

// RLS lets you delete only your own.
export async function removeSubscription(endpoint: unknown): Promise<void> {
  if (typeof endpoint !== 'string') return
  const { error } = await (await createClient()).from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) console.error('Could not remove a push subscription', error)
}

type PushResult = 'sent' | 'gone' | 'failed'

// Encrypts a notification for one phone and hands it to its push service.
// 'gone' means the phone's subscription is no more (notifications turned off
// there, or the app removed), so it can be forgotten.
async function push(sub: Subscription, notice: Notice, cfg: Config): Promise<PushResult> {
  if (!isPushEndpoint(sub.endpoint)) return 'gone'
  let request: ReturnType<typeof webpush.generateRequestDetails>
  try {
    request = webpush.generateRequestDetails(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(notice),
      { vapidDetails: cfg.vapid, TTL: TTL_S, urgency: 'normal', contentEncoding: 'aes128gcm' },
    )
  } catch (e) {
    // Saved subscriptions were checked, so not one to forget for this.
    console.warn('Could not seal a notification', e)
    return 'failed'
  }
  // As text (TTL comes as a number), and without the length: fetch works that
  // out from the body itself.
  const headers = Object.fromEntries(
    Object.entries(request.headers).filter(([name]) => name !== 'Content-Length').map(([name, value]) => [name, String(value)]),
  )
  try {
    const res = await fetch(request.endpoint, {
      method: request.method,
      headers,
      body: new Uint8Array(request.body!),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.status === 404 || res.status === 410) return 'gone'
    if (!res.ok) {
      console.warn(`A push service answered ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return 'failed'
    }
    return 'sent'
  } catch (e) {
    console.warn('Could not reach a push service', e)
    return 'failed'
  }
}

type Notify = { roomId: string | null | undefined; change: RoomChange }

// Tells a room's other members what changed, once the response has gone, so
// the change never waits on it or fails because of it. A change to your own
// list or plan (no room) tells no one. Given a function, works out what to say
// then too, so a lookup it needs doesn't hold up the change either.
export function notifyRoom(what: Notify | (() => Promise<Notify | null>)): void {
  const cfg = config()
  if (!cfg) return
  after(async () => {
    try {
      const notify = typeof what === 'function' ? await what() : what
      if (notify?.roomId) await tell(notify.roomId, notify.change, cfg)
    } catch (e) {
      console.error('Could not notify the room', e)
    }
  })
}

async function tell(roomId: string, change: RoomChange, cfg: Config) {
  // Read as the member who made the change: the room, its members and their
  // name are all theirs to see.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const [room, members, me] = await Promise.all([
    supabase.from('rooms').select('name').eq('id', roomId).maybeSingle(),
    supabase.from('room_members').select('user_id').eq('room_id', roomId).neq('user_id', user.id),
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
  ])
  for (const { error } of [room, members, me]) if (error) throw error
  const others = ((members.data ?? []) as { user_id: string }[]).map((m) => m.user_id)
  if (!room.data || !others.length) return

  // One notification for a run of changes.
  const db = admin(cfg)
  const kind = noticeGroup(change)
  const last = await db.from('push_notices').select('sent_at')
    .eq('room_id', roomId).eq('actor_id', user.id).eq('kind', kind).maybeSingle()
  if (last.error) throw last.error
  if (last.data && Date.now() - new Date(last.data.sent_at).getTime() < QUIET_MS) return
  const stamp = await db.from('push_notices')
    .upsert({ room_id: roomId, actor_id: user.id, kind, sent_at: new Date().toISOString() })
  if (stamp.error) throw stamp.error

  const subs = await db.from('push_subscriptions').select('endpoint, p256dh, auth, locale').in('user_id', others)
  if (subs.error) throw subs.error
  const who = (me.data as { display_name: string | null } | null)?.display_name ?? null
  const roomName = (room.data as { name: string }).name
  const results = await Promise.all(((subs.data ?? []) as Subscription[]).map(async (sub) => ({
    endpoint: sub.endpoint,
    result: await push(sub, roomNotice(change, { locale: asLocale(sub.locale), who, room: roomName, roomId }), cfg),
  })))
  const gone = results.filter((r) => r.result === 'gone').map((r) => r.endpoint)
  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone)
}

export type TestResult = PushResult | 'not-configured'

// A notification to this phone alone, to see that they arrive.
export async function sendTestPush(endpoint: unknown): Promise<TestResult> {
  const cfg = config()
  if (!cfg) return 'not-configured'
  if (typeof endpoint !== 'string') return 'gone'
  const supabase = await createClient()
  const { data, error } = await supabase.from('push_subscriptions')
    .select('endpoint, p256dh, auth, locale').eq('endpoint', endpoint).maybeSingle()
  if (error) throw error
  if (!data) return 'gone'
  const sub = data as Subscription
  const locale = asLocale(sub.locale)
  const result = await push(sub, { title: 'RecipeGo', body: translate(locale, 'push.testBody'), url: '/rooms', tag: 'test' }, cfg)
  if (result === 'gone') await removeSubscription(endpoint)
  return result
}
