'use client'
import { removePushSubscriptionAction, savePushSubscriptionAction } from '@/app/notifications/actions'
import type { Locale } from '@/lib/i18n'
import type { SaveResult } from '@/lib/push/send'

// The phone's side of notifications: turning them on and off, and keeping the
// server's copy of this phone's subscription current. The sending is in
// lib/push/send.ts, and showing them in public/sw.js.

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

// Where notifications can be turned on: here ('ok'); on an iPhone or iPad, only
// in RecipeGo opened from the Home Screen ('home-screen'), as Safari and Chrome
// there have no push; or nowhere in this browser ('unsupported').
export type PushSupport = 'ok' | 'home-screen' | 'unsupported'
export function pushSupport(): PushSupport {
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'ok'
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return apple ? 'home-screen' : 'unsupported'
}

export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), (c) => c.charCodeAt(0))
}

// What the server was last given, so it's only sent again when something changed.
const KEY = 'recipego:push'
const WEEK = 7 * 24 * 60 * 60_000
type Saved = { endpoint: string; locale: Locale; at: number }
function lastSaved(): Saved | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null
  } catch {
    return null
  }
}
function remember(saved: Saved | null) {
  try {
    if (saved) localStorage.setItem(KEY, JSON.stringify(saved))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage blocked: it's just sent again next time.
  }
}

async function save(sub: PushSubscription, locale: Locale): Promise<SaveResult> {
  const result = await savePushSubscriptionAction(sub.toJSON(), locale)
  if (result === 'saved') remember({ endpoint: sub.endpoint, locale, at: Date.now() })
  return result
}

// A subscription made with an older key pair can't be sent to with this one.
function madeWithOurKey(sub: PushSubscription): boolean {
  const key = sub.options?.applicationServerKey
  if (!key) return true
  const ours = keyBytes(VAPID_PUBLIC_KEY)
  const theirs = new Uint8Array(key)
  return theirs.length === ours.length && theirs.every((b, i) => b === ours[i])
}

export type TurnOnResult = 'on' | 'blocked' | 'dismissed' | Exclude<SaveResult, 'saved'>

// Call straight from a tap: an iPhone asks for permission only then, so asking
// comes before anything else is waited on.
export async function turnOnPush(locale: Locale): Promise<TurnOnResult> {
  const permission = await Notification.requestPermission()
  if (permission === 'denied') return 'blocked'
  if (permission !== 'granted') return 'dismissed'
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (sub && !madeWithOurKey(sub)) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) })
  const result = await save(sub, locale)
  if (result === 'saved') return 'on'
  // Not kept by the server, so not kept here either: it would never be sent to.
  await sub.unsubscribe().catch(() => {})
  return result
}

export async function turnOffPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  remember(null)
  if (!sub) return
  await removePushSubscriptionAction(sub.endpoint)
  await sub.unsubscribe()
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

// Keeps the server's copy current: a browser renews its subscription now and
// then (a new address), the app's language may have changed, and once a week
// it's sent anyway in case the server lost it.
export async function syncPush(locale: Locale): Promise<void> {
  if (pushSupport() !== 'ok' || !VAPID_PUBLIC_KEY) return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) {
    remember(null)
    return
  }
  const last = lastSaved()
  if (last?.endpoint === sub.endpoint && last.locale === locale && Date.now() - last.at < WEEK) return
  await save(sub, locale)
}

// Signed out: this phone stops getting the account's notifications. (The
// server forgets the subscription the next time it's sent to.)
export async function dropPush(): Promise<void> {
  remember(null)
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager?.getSubscription()
  await sub?.unsubscribe()
}
