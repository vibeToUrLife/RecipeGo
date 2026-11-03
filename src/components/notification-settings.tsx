'use client'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import { useLocale, useT } from '@/components/i18n-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { sendTestPushAction } from '@/app/notifications/actions'
import { currentSubscription, pushSupport, turnOffPush, turnOnPush, VAPID_PUBLIC_KEY, type PushSupport } from '@/lib/push-client'

const never = () => () => {}

// Turns notifications on or off for this phone: when someone in any of your
// rooms changes a meal plan or shopping list, you're told here. Not shown until
// the server has its VAPID keys.
export function NotificationSettings() {
  const t = useT()
  const locale = useLocale()
  // Only the phone knows; the server and the hydration render say 'checking'.
  const support = useSyncExternalStore<PushSupport | 'checking'>(never, pushSupport, () => 'checking')
  const [on, setOn] = useState<boolean | null>(null) // null: not known yet
  const [blocked, setBlocked] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (support !== 'ok') return
    let gone = false
    currentSubscription().then((sub) => {
      if (gone) return
      setOn(!!sub)
      setBlocked(!sub && Notification.permission === 'denied')
    })
    return () => {
      gone = true
    }
  }, [support])

  if (!VAPID_PUBLIC_KEY) return null

  async function turnOn() {
    setBusy(true)
    try {
      const result = await turnOnPush(locale)
      if (result === 'on') setOn(true)
      else if (result === 'blocked') setBlocked(true)
      else if (result === 'not-configured') toast.error(t('notify.notSetUp'))
      else if (result !== 'dismissed') toast.error(t('notify.failed'))
    } catch (e) {
      console.error(e)
      toast.error(t('notify.failed'))
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    try {
      await turnOffPush()
      setOn(false)
    } catch (e) {
      console.error(e)
      toast.error(t('notify.failed'))
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    try {
      const sub = await currentSubscription()
      const result = sub ? await sendTestPushAction(sub.endpoint) : 'gone'
      if (result === 'sent') toast.success(t('notify.testSent'))
      else if (result === 'not-configured') toast.error(t('notify.notSetUp'))
      else toast.error(t('notify.testFailed'))
      // The server has no record of this phone, or its push service says the
      // subscription is gone: off here too, so turning it on starts afresh.
      if (result === 'gone') {
        await sub?.unsubscribe().catch(() => {})
        setOn(false)
      }
    } catch (e) {
      console.error(e)
      toast.error(t('notify.testFailed'))
    } finally {
      setBusy(false)
    }
  }

  let body: React.ReactNode = null
  if (support === 'home-screen') body = <p className="text-sm">{t('notify.iosHint')}</p>
  else if (support === 'unsupported') body = <p className="text-sm">{t('notify.unsupported')}</p>
  else if (support === 'ok' && on) {
    body = (
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm">{t('notify.on')}</p>
        <Button type="button" variant="outline" size="sm" onClick={test} disabled={busy}>{t('notify.test')}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={turnOff} disabled={busy}>{t('notify.turnOff')}</Button>
      </div>
    )
  } else if (support === 'ok' && on === false) {
    body = blocked
      ? <p className="text-sm">{t('notify.blocked')}</p>
      : <Button type="button" onClick={turnOn} disabled={busy}>{busy ? t('notify.turningOn') : t('notify.turnOn')}</Button>
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-lg text-primary">
          <Bell className="size-5" />
          {t('notify.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('notify.intro')}</p>
        {body}
      </CardContent>
    </Card>
  )
}
