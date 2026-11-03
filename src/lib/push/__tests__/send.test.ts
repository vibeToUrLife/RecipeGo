import crypto from 'node:crypto'
import webpush from 'web-push'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
// after() runs its work once the response has gone; here, at once, kept to await.
const pending: Promise<unknown>[] = []
vi.mock('next/server', () => ({ after: (work: () => Promise<unknown>) => { pending.push(work()) } }))
const clients: { user: unknown; admin: unknown } = { user: null, admin: null }
vi.mock('@/utils/supabase/server', () => ({ createClient: async () => clients.user }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => clients.admin }))

import { isPushEndpoint, notifyRoom, pushConfigured, saveSubscription, sendTestPush } from '@/lib/push/send'

// ---- a stand-in for the database, recording which client asked what --------
type Row = Record<string, unknown>
let db: Record<string, Row[]>
let asked: { by: 'user' | 'admin'; table: string; op: string }[]
const KEYS: Record<string, string[]> = { push_notices: ['room_id', 'actor_id', 'kind'], push_subscriptions: ['endpoint'] }

function client(by: 'user' | 'admin', userId: string | null) {
  return {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from(table: string) {
      const filters: ((r: Row) => boolean)[] = []
      let op = 'select'
      let row: Row = {}
      let onConflict: string | undefined
      const rows = () => (db[table] ??= [])
      const run = () => {
        asked.push({ by, table, op })
        if (op === 'upsert') {
          const key = onConflict ? onConflict.split(',') : KEYS[table]
          const at = rows().findIndex((r) => key.every((k) => r[k] === row[k]))
          if (at >= 0) rows()[at] = { ...rows()[at], ...row }
          else rows().push({ ...row })
          return { data: null, error: null }
        }
        const hit = rows().filter((r) => filters.every((f) => f(r)))
        if (op === 'delete') db[table] = rows().filter((r) => !hit.includes(r))
        return { data: op === 'delete' ? null : hit, error: null }
      }
      const q = {
        select: () => q,
        delete: () => ((op = 'delete'), q),
        upsert: (r: Row, opts?: { onConflict?: string }) => ((op = 'upsert'), (row = r), (onConflict = opts?.onConflict), q),
        eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
        neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), q),
        in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
        maybeSingle: async () => ({ data: (run().data as Row[])[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
      }
      return q
    },
  }
}

// ---- phones: a real key pair each, so what's sent can be opened -------------
function phone(userId: string, locale: 'en' | 'zh', host = 'fcm.googleapis.com') {
  const ecdh = crypto.createECDH('prime256v1')
  ecdh.generateKeys()
  const secret = crypto.randomBytes(16)
  const row = {
    endpoint: `https://${host}/fcm/send/${crypto.randomUUID()}`,
    user_id: userId,
    p256dh: ecdh.getPublicKey().toString('base64url'),
    auth: secret.toString('base64url'),
    locale,
  }
  return { ecdh, secret, row, json: { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } } }
}

// Opens a message the way the phone would (RFC 8291, aes128gcm), without the
// library that sealed it.
function open(body: Uint8Array, to: ReturnType<typeof phone>): unknown {
  const buf = Buffer.from(body)
  const salt = buf.subarray(0, 16)
  const idlen = buf[20]
  const senderKey = buf.subarray(21, 21 + idlen)
  const sealed = buf.subarray(21 + idlen)
  const shared = to.ecdh.computeSecret(senderKey)
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), to.ecdh.getPublicKey(), senderKey])
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, to.secret, info, 32))
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16))
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12))
  const decipher = crypto.createDecipheriv('aes-128-gcm', cek, nonce)
  decipher.setAuthTag(sealed.subarray(sealed.length - 16))
  const plain = Buffer.concat([decipher.update(sealed.subarray(0, sealed.length - 16)), decipher.final()])
  return JSON.parse(plain.subarray(0, plain.lastIndexOf(2)).toString('utf8')) // a final record ends in 2
}

// The VAPID token on a request: signed with our private key, for that push service.
function vapidClaims(headers: Record<string, string>, publicKey: string) {
  const [, token, key] = headers.Authorization.match(/^vapid t=([^,]+), k=(.+)$/) ?? []
  expect(key).toBe(publicKey)
  const [head, claims, signature] = token.split('.')
  const point = Buffer.from(publicKey, 'base64url')
  const jwk = { kty: 'EC', crv: 'P-256', x: point.subarray(1, 33).toString('base64url'), y: point.subarray(33).toString('base64url') }
  const verified = crypto.verify('sha256', Buffer.from(`${head}.${claims}`), { key: crypto.createPublicKey({ key: jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'))
  expect(verified).toBe(true)
  return JSON.parse(Buffer.from(claims, 'base64url').toString())
}

let vapid: { publicKey: string; privateKey: string }
let alex: ReturnType<typeof phone>, bo: ReturnType<typeof phone>, cy: ReturnType<typeof phone>
let fetchMock: ReturnType<typeof vi.fn>
const sentTo = (p: ReturnType<typeof phone>) => fetchMock.mock.calls.find(([url]) => url === p.row.endpoint)?.[1] as RequestInit & { headers: Record<string, string>; body: Uint8Array } | undefined
const settle = () => Promise.all(pending.splice(0))

beforeEach(() => {
  vapid = webpush.generateVAPIDKeys()
  vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', vapid.publicKey)
  vi.stubEnv('VAPID_PRIVATE_KEY', vapid.privateKey)
  vi.stubEnv('VAPID_SUBJECT', 'mailto:cook@example.com')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.supabase.co')
  alex = phone('alex', 'en')
  bo = phone('bo', 'zh')
  cy = phone('cy', 'en', 'web.push.apple.com')
  db = {
    rooms: [{ id: 'r1', name: 'Southbay Kitchen' }],
    room_members: [{ room_id: 'r1', user_id: 'alex' }, { room_id: 'r1', user_id: 'bo' }, { room_id: 'r1', user_id: 'cy' }],
    profiles: [{ id: 'alex', display_name: 'Alex' }, { id: 'bo', display_name: 'Bo' }],
    push_subscriptions: [alex.row, bo.row, cy.row],
    push_notices: [],
  }
  asked = []
  clients.user = client('user', 'alex')
  clients.admin = client('admin', null)
  fetchMock = vi.fn(async () => new Response(null, { status: 201 }))
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
  pending.length = 0
})

describe('notifyRoom', () => {
  it('does nothing until the server has its keys', async () => {
    vi.stubEnv('VAPID_PRIVATE_KEY', '')
    expect(pushConfigured()).toBe(false)
    notifyRoom({ roomId: 'r1', change: { kind: 'listItem', item: 'eggs' } })
    await settle()
    expect(pending).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stays off with keys that aren’t a real pair, such as placeholders', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'your-vapid-public-key')
    expect(pushConfigured()).toBe(false)
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', vapid.publicKey)
    vi.stubEnv('VAPID_SUBJECT', 'you')
    expect(pushConfigured()).toBe(false)
    vi.stubEnv('VAPID_SUBJECT', '')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'recipego-five.vercel.app')
    expect(pushConfigured()).toBe(true) // the site's own address stands in
  })

  it('tells no one about a change to your own list or plan', async () => {
    notifyRoom({ roomId: null, change: { kind: 'listItem', item: 'eggs' } })
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('tells the room’s other members, each in their own language, and not the one who made the change', async () => {
    notifyRoom({ roomId: 'r1', change: { kind: 'listItem', item: 'eggs' } })
    await settle()

    expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual([bo.row.endpoint, cy.row.endpoint].sort())
    expect(open(sentTo(bo)!.body, bo)).toEqual({ title: 'Southbay Kitchen · 购物清单', body: 'Alex 加了 eggs', url: '/rooms/r1/shopping-list', tag: 'list:r1' })
    expect(open(sentTo(cy)!.body, cy)).toMatchObject({ title: 'Southbay Kitchen · Shopping list', body: 'Alex added eggs' })
  })

  it('sends each the way push services expect: sealed for that phone, signed with our key', async () => {
    notifyRoom({ roomId: 'r1', change: { kind: 'listDone', n: 3 } })
    await settle()

    const toApple = sentTo(cy)!
    expect(toApple.method).toBe('POST')
    expect(toApple.headers).toMatchObject({ 'Content-Encoding': 'aes128gcm', TTL: '43200', Urgency: 'normal' })
    const claims = vapidClaims(toApple.headers, vapid.publicKey)
    expect(claims.aud).toBe('https://web.push.apple.com')
    expect(claims.sub).toBe('mailto:cook@example.com')
    expect(claims.exp * 1000).toBeGreaterThan(Date.now())
    expect(claims.exp * 1000).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60_000)
  })

  it('reads the other members’ subscriptions with the service role key, and nothing else with it', async () => {
    notifyRoom({ roomId: 'r1', change: { kind: 'listWeek' } })
    await settle()

    const byAdmin = new Set(asked.filter((a) => a.by === 'admin').map((a) => a.table))
    expect([...byAdmin].sort()).toEqual(['push_notices', 'push_subscriptions'])
    expect(asked.filter((a) => a.by === 'user').map((a) => a.table).sort()).toEqual(['profiles', 'room_members', 'rooms'])
  })

  it('buzzes the others once for a run of changes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-03T10:00:00Z'))
    notifyRoom({ roomId: 'r1', change: { kind: 'listItem', item: 'eggs' } })
    await settle()
    vi.setSystemTime(new Date('2026-11-03T10:03:00Z'))
    notifyRoom({ roomId: 'r1', change: { kind: 'listItem', item: 'milk' } })
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(2) // the first change, to Bo and Cy

    // Finishing the shop is news of its own, straight after.
    notifyRoom({ roomId: 'r1', change: { kind: 'listDone', n: 2 } })
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(4)

    // Five quiet minutes on, a change is news again.
    vi.setSystemTime(new Date('2026-11-03T10:06:00Z'))
    notifyRoom({ roomId: 'r1', change: { kind: 'listItem', item: 'rice' } })
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(open(sentTo(bo)!.body, bo)).toMatchObject({ body: 'Alex 加了 eggs' })
  })

  it('works out what to say after the response, when given a function', async () => {
    const say = vi.fn(async () => ({ roomId: 'r1', change: { kind: 'planCopied' as const, n: 4, week: '2026-11-02' } }))
    notifyRoom(say)
    await settle()
    expect(say).toHaveBeenCalled()
    expect(open(sentTo(cy)!.body, cy)).toMatchObject({ body: 'Alex copied 4 meal(s) from last week' })
  })

  it('forgets a phone whose subscription has gone', async () => {
    fetchMock.mockImplementation(async (url: string) => new Response(null, { status: url === bo.row.endpoint ? 410 : 201 }))
    notifyRoom({ roomId: 'r1', change: { kind: 'listItem', item: 'eggs' } })
    await settle()
    expect(db.push_subscriptions.map((s) => s.endpoint)).toEqual([alex.row.endpoint, cy.row.endpoint])
  })

  it('keeps going when a push service fails or can’t be reached', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === bo.row.endpoint) throw new TypeError('fetch failed')
      return new Response('busy', { status: 503 })
    })
    notifyRoom({ roomId: 'r1', change: { kind: 'listItem', item: 'eggs' } })
    await expect(settle()).resolves.toBeDefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(db.push_subscriptions).toHaveLength(3) // not gone, just not now
  })

  it('never sends to an address that isn’t a push service’s', async () => {
    db.push_subscriptions = [{ ...cy.row, endpoint: 'https://evil.example/collect' }]
    notifyRoom({ roomId: 'r1', change: { kind: 'listItem', item: 'eggs' } })
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(db.push_subscriptions).toHaveLength(0)
  })

  it('tells no one when the member making the change isn’t signed in, or is alone in the room', async () => {
    clients.user = client('user', null)
    notifyRoom({ roomId: 'r1', change: { kind: 'listItem', item: 'eggs' } })
    await settle()
    clients.user = client('user', 'alex')
    db.room_members = [{ room_id: 'r1', user_id: 'alex' }]
    notifyRoom({ roomId: 'r1', change: { kind: 'listItem', item: 'eggs' } })
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('saveSubscription', () => {
  it('saves this phone as the signed-in user’s, in their language', async () => {
    db.push_subscriptions = []
    expect(await saveSubscription(bo.json, 'zh')).toBe('saved')
    expect(db.push_subscriptions).toEqual([{ ...bo.row, user_id: 'alex', locale: 'zh' }])
    expect(asked.find((a) => a.table === 'push_subscriptions')?.by).toBe('admin')
  })

  it('hands over a phone that was signed into another account', async () => {
    expect(await saveSubscription(bo.json, 'en')).toBe('saved')
    expect(db.push_subscriptions.filter((s) => s.endpoint === bo.row.endpoint)).toEqual([{ ...bo.row, user_id: 'alex', locale: 'en' }])
  })

  it('falls back to English for a language the app doesn’t have', async () => {
    db.push_subscriptions = []
    await saveSubscription(bo.json, 'fr')
    expect(db.push_subscriptions[0].locale).toBe('en')
  })

  it('refuses anything that isn’t a real subscription', async () => {
    const bad = [
      null,
      'nope',
      { ...bo.json, endpoint: 'https://evil.example/collect' },
      { ...bo.json, endpoint: bo.json.endpoint.replace('https:', 'http:') },
      { ...bo.json, keys: { ...bo.json.keys, p256dh: 'short' } },
      { ...bo.json, keys: { ...bo.json.keys, auth: crypto.randomBytes(32).toString('base64url') } },
      { endpoint: bo.json.endpoint },
    ]
    for (const input of bad) expect(await saveSubscription(input, 'en')).toBe('invalid')
    expect(asked).toHaveLength(0)
  })

  it('needs someone signed in, and the server set up', async () => {
    clients.user = client('user', null)
    expect(await saveSubscription(bo.json, 'en')).toBe('signed-out')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    expect(await saveSubscription(bo.json, 'en')).toBe('not-configured')
  })
})

describe('sendTestPush', () => {
  it('sends this phone a notification in its language', async () => {
    expect(await sendTestPush(alex.row.endpoint)).toBe('sent')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(open(sentTo(alex)!.body, alex)).toMatchObject({ title: 'RecipeGo', tag: 'test', url: '/rooms' })
  })

  it('says so when the server has no such subscription, or its push service has let it go', async () => {
    expect(await sendTestPush('https://fcm.googleapis.com/fcm/send/unknown')).toBe('gone')
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))
    expect(await sendTestPush(alex.row.endpoint)).toBe('gone')
    expect(db.push_subscriptions.some((s) => s.endpoint === alex.row.endpoint)).toBe(false)
  })
})

describe('isPushEndpoint', () => {
  it('takes the big push services’ addresses', () => {
    for (const url of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://web.push.apple.com/QK7qx',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ]) expect(isPushEndpoint(url)).toBe(true)
  })

  it('refuses anywhere else', () => {
    for (const url of [
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://evil.example/fcm/send/abc',
      'https://fcm.googleapis.com.evil.example/abc',
      'https://evilgoogleapis.com/abc',
      'https://user:pw@fcm.googleapis.com/abc',
      'https://fcm.googleapis.com:8443/abc',
      'not a url',
      42,
      `https://fcm.googleapis.com/${'a'.repeat(1000)}`,
    ]) expect(isPushEndpoint(url)).toBe(false)
  })
})
