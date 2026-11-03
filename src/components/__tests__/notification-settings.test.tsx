import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.hoisted(() => ({ key: 'server-key' }))
vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k, useLocale: () => 'zh' }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/app/notifications/actions', () => ({ sendTestPushAction: vi.fn() }))
vi.mock('@/lib/push-client', () => ({
  get VAPID_PUBLIC_KEY() {
    return push.key
  },
  pushSupport: vi.fn(() => 'ok'),
  currentSubscription: vi.fn(async () => null),
  turnOnPush: vi.fn(),
  turnOffPush: vi.fn(async () => {}),
}))

import { toast } from 'sonner'
import { sendTestPushAction } from '@/app/notifications/actions'
import { currentSubscription, pushSupport, turnOffPush, turnOnPush } from '@/lib/push-client'
import { NotificationSettings } from '@/components/notification-settings'

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc'
const subscribed = () => {
  const sub = { endpoint: ENDPOINT, unsubscribe: vi.fn(async () => true) }
  vi.mocked(currentSubscription).mockResolvedValue(sub as unknown as PushSubscription)
  return sub
}
const button = (name: string) => screen.findByRole('button', { name })

beforeEach(() => {
  vi.clearAllMocks()
  push.key = 'server-key'
  vi.mocked(pushSupport).mockReturnValue('ok')
  vi.mocked(currentSubscription).mockResolvedValue(null)
  vi.stubGlobal('Notification', { permission: 'default' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllGlobals())

describe('NotificationSettings', () => {
  it('isn’t shown until the server has its keys', () => {
    push.key = ''
    const { container } = render(<NotificationSettings />)
    expect(container).toBeEmptyDOMElement()
  })

  it('turns notifications on for this phone, in the app’s language', async () => {
    vi.mocked(turnOnPush).mockResolvedValue('on')
    render(<NotificationSettings />)
    fireEvent.click(await button('notify.turnOn'))
    await screen.findByText('notify.on')
    expect(turnOnPush).toHaveBeenCalledWith('zh')
  })

  it('shows when they’re on, and turns them off', async () => {
    subscribed()
    render(<NotificationSettings />)
    await screen.findByText('notify.on')
    fireEvent.click(await button('notify.turnOff'))
    await button('notify.turnOn')
    expect(turnOffPush).toHaveBeenCalled()
  })

  it('sends a test, and says it’s on its way', async () => {
    subscribed()
    vi.mocked(sendTestPushAction).mockResolvedValue('sent')
    render(<NotificationSettings />)
    fireEvent.click(await button('notify.test'))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('notify.testSent'))
    expect(sendTestPushAction).toHaveBeenCalledWith(ENDPOINT)
  })

  it('starts afresh when the test finds the server no longer has this phone', async () => {
    const sub = subscribed()
    vi.mocked(sendTestPushAction).mockResolvedValue('gone')
    render(<NotificationSettings />)
    fireEvent.click(await button('notify.test'))
    await button('notify.turnOn')
    expect(sub.unsubscribe).toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('notify.testFailed')
  })

  it('points an iPhone to the Home Screen first', () => {
    vi.mocked(pushSupport).mockReturnValue('home-screen')
    render(<NotificationSettings />)
    expect(screen.getByText('notify.iosHint')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('says so where the browser has no notifications', () => {
    vi.mocked(pushSupport).mockReturnValue('unsupported')
    render(<NotificationSettings />)
    expect(screen.getByText('notify.unsupported')).toBeInTheDocument()
  })

  it('explains how to unblock them, rather than offering a button that can’t work', async () => {
    vi.stubGlobal('Notification', { permission: 'denied' })
    render(<NotificationSettings />)
    expect(await screen.findByText('notify.blocked')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('says so when blocked at the question, or when the server isn’t set up', async () => {
    vi.mocked(turnOnPush).mockResolvedValueOnce('blocked')
    const { unmount } = render(<NotificationSettings />)
    fireEvent.click(await button('notify.turnOn'))
    await screen.findByText('notify.blocked')
    unmount()

    vi.mocked(turnOnPush).mockResolvedValueOnce('not-configured')
    render(<NotificationSettings />)
    fireEvent.click(await button('notify.turnOn'))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('notify.notSetUp'))
  })

  it('says nothing if the question was waved away, and a toast if turning on failed', async () => {
    vi.mocked(turnOnPush).mockResolvedValueOnce('dismissed').mockRejectedValueOnce(new Error('AbortError'))
    render(<NotificationSettings />)
    fireEvent.click(await button('notify.turnOn'))
    await waitFor(() => expect(turnOnPush).toHaveBeenCalledTimes(1))
    expect(toast.error).not.toHaveBeenCalled()
    fireEvent.click(await button('notify.turnOn'))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('notify.failed'))
  })
})
