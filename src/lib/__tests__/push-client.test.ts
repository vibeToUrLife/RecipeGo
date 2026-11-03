import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A public key (only ever public) for the tests.
const KEY = vi.hoisted(() => {
  const key = 'BCRNj5XL5V8grjrBe2DKfk2NaroDY_OiokxSqIHLTMPKruiqlXcJUgk19fp5XEsShhmoyVlZa7Kog64Xg0qTjds'
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = key
  return key
})
vi.mock('@/app/notifications/actions', () => ({
  savePushSubscriptionAction: vi.fn(async () => 'saved'),
  removePushSubscriptionAction: vi.fn(async () => {}),
}))

import { removePushSubscriptionAction, savePushSubscriptionAction } from '@/app/notifications/actions'
import { dropPush, keyBytes, pushSupport, syncPush, turnOffPush, turnOnPush } from '@/lib/push-client'

const MEMORY = 'recipego:push'
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/old'

function subscription(endpoint: string, key?: Uint8Array) {
  return {
    endpoint,
    options: { applicationServerKey: key ? key.slice().buffer : null },
    toJSON: () => ({ endpoint, keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn(async () => true),
  }
}

// A browser with push: a service worker, its push manager, and Notification.
function browser({ existing = null as ReturnType<typeof subscription> | null, permission = 'granted' } = {}) {
  let current = existing
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async ({ applicationServerKey }: { applicationServerKey: Uint8Array }) =>
      (current = subscription('https://fcm.googleapis.com/fcm/send/new', applicationServerKey))),
  }
  const reg = { pushManager }
  Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve(reg), getRegistration: async () => reg }, configurable: true })
  vi.stubGlobal('PushManager', function PushManager() {})
  vi.stubGlobal('Notification', { permission, requestPermission: vi.fn(async () => permission) })
  return { pushManager, current: () => current }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})
afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>).serviceWorker
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('pushSupport', () => {
  const as = (userAgent: string) => vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)

  it('is “ok” where the browser has push', () => {
    browser()
    expect(pushSupport()).toBe('ok')
  })

  it('points an iPhone to the Home Screen, where its push is', () => {
    as('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1')
    expect(pushSupport()).toBe('home-screen')
  })

  it('is “unsupported” in any other browser without push', () => {
    as('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)')
    expect(pushSupport()).toBe('unsupported')
  })
})

it('keyBytes turns a base64url key into its bytes', () => {
  expect(Buffer.from(keyBytes(KEY)).toString('base64url')).toBe(KEY)
  expect(keyBytes(KEY)).toHaveLength(65)
})

describe('turnOnPush', () => {
  it('asks for permission before waiting on anything, as an iPhone only asks straight from a tap', async () => {
    browser()
    const on = turnOnPush('zh')
    expect(Notification.requestPermission).toHaveBeenCalled()
    await on
  })

  it('subscribes with the server’s key and saves it in the app’s language', async () => {
    const b = browser()
    expect(await turnOnPush('zh')).toBe('on')
    expect(b.pushManager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) })
    expect(savePushSubscriptionAction).toHaveBeenCalledWith(b.current()!.toJSON(), 'zh')
    expect(JSON.parse(localStorage.getItem(MEMORY)!)).toMatchObject({ endpoint: b.current()!.endpoint, locale: 'zh' })
  })

  it('says so when notifications are blocked, or the question was waved away', async () => {
    const blocked = browser({ permission: 'denied' })
    expect(await turnOnPush('en')).toBe('blocked')
    expect(blocked.pushManager.subscribe).not.toHaveBeenCalled()
    browser({ permission: 'default' })
    expect(await turnOnPush('en')).toBe('dismissed')
  })

  it('lets the subscription go again if the server won’t keep it', async () => {
    const b = browser()
    vi.mocked(savePushSubscriptionAction).mockResolvedValueOnce('not-configured')
    expect(await turnOnPush('en')).toBe('not-configured')
    expect(b.current()!.unsubscribe).toHaveBeenCalled()
    expect(localStorage.getItem(MEMORY)).toBeNull()
  })

  it('keeps a subscription made with the server’s key, and replaces one made with an old key', async () => {
    const ours = subscription(ENDPOINT, keyBytes(KEY))
    const mine = browser({ existing: ours })
    await turnOnPush('en')
    expect(mine.pushManager.subscribe).not.toHaveBeenCalled()
    expect(savePushSubscriptionAction).toHaveBeenLastCalledWith(ours.toJSON(), 'en')

    const old = subscription(ENDPOINT, new Uint8Array(65).fill(4))
    const stale = browser({ existing: old })
    await turnOnPush('en')
    expect(old.unsubscribe).toHaveBeenCalled()
    expect(stale.pushManager.subscribe).toHaveBeenCalled()
  })
})

it('turnOffPush has the server forget this phone, then unsubscribes', async () => {
  const sub = subscription(ENDPOINT)
  browser({ existing: sub })
  localStorage.setItem(MEMORY, JSON.stringify({ endpoint: ENDPOINT, locale: 'en', at: Date.now() }))
  await turnOffPush()
  expect(removePushSubscriptionAction).toHaveBeenCalledWith(ENDPOINT)
  expect(sub.unsubscribe).toHaveBeenCalled()
  expect(localStorage.getItem(MEMORY)).toBeNull()
})

describe('syncPush', () => {
  it('gives the server this phone’s subscription when it hasn’t had it', async () => {
    browser({ existing: subscription(ENDPOINT) })
    await syncPush('en')
    expect(savePushSubscriptionAction).toHaveBeenCalledTimes(1)
  })

  it('then not again, until the language or the address changes, or a week goes by', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-03T10:00:00Z'))
    browser({ existing: subscription(ENDPOINT) })
    await syncPush('en')
    await syncPush('en')
    expect(savePushSubscriptionAction).toHaveBeenCalledTimes(1)

    await syncPush('zh')
    expect(savePushSubscriptionAction).toHaveBeenLastCalledWith(expect.anything(), 'zh')
    expect(savePushSubscriptionAction).toHaveBeenCalledTimes(2)

    browser({ existing: subscription('https://fcm.googleapis.com/fcm/send/renewed') })
    await syncPush('zh')
    expect(savePushSubscriptionAction).toHaveBeenCalledTimes(3)

    vi.setSystemTime(new Date('2026-11-11T10:00:00Z'))
    await syncPush('zh')
    expect(savePushSubscriptionAction).toHaveBeenCalledTimes(4)
  })

  it('does nothing with notifications off, or where there’s no push', async () => {
    localStorage.setItem(MEMORY, JSON.stringify({ endpoint: ENDPOINT, locale: 'en', at: Date.now() }))
    browser()
    await syncPush('en')
    expect(localStorage.getItem(MEMORY)).toBeNull()
    vi.unstubAllGlobals()
    delete (navigator as unknown as Record<string, unknown>).serviceWorker
    await syncPush('en')
    expect(savePushSubscriptionAction).not.toHaveBeenCalled()
  })
})

it('dropPush unsubscribes this phone without the server (no one is signed in to ask)', async () => {
  const sub = subscription(ENDPOINT)
  browser({ existing: sub })
  localStorage.setItem(MEMORY, JSON.stringify({ endpoint: ENDPOINT, locale: 'en', at: Date.now() }))
  await dropPush()
  expect(sub.unsubscribe).toHaveBeenCalled()
  expect(removePushSubscriptionAction).not.toHaveBeenCalled()
  expect(localStorage.getItem(MEMORY)).toBeNull()
})
