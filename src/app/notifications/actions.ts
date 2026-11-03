'use server'
import {
  removeSubscription,
  saveSubscription,
  sendTestPush,
  type SaveResult,
  type TestResult,
} from '@/lib/push/send'

// This phone's push subscription (PushSubscription.toJSON()), in the language
// its notifications should be written in.
export async function savePushSubscriptionAction(subscription: unknown, locale: unknown): Promise<SaveResult> {
  return saveSubscription(subscription, locale)
}

export async function removePushSubscriptionAction(endpoint: unknown): Promise<void> {
  await removeSubscription(endpoint)
}

export async function sendTestPushAction(endpoint: unknown): Promise<TestResult> {
  try {
    return await sendTestPush(endpoint)
  } catch (e) {
    console.error(e)
    return 'failed'
  }
}
