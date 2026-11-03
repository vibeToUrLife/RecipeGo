import { translate, type Locale } from '@/lib/i18n'
import type { MealSlot } from '@/lib/plan/week'

// What someone changed in a room, for the notification its other members get.
export type RoomChange =
  | { kind: 'listItem'; item: string }
  | { kind: 'listRecipe'; recipe: string }
  | { kind: 'listWeek' }
  | { kind: 'listDone'; n: number }
  | { kind: 'planAdded' | 'planMoved' | 'planRemoved'; recipe: string; date: string; slot: MealSlot }
  | { kind: 'planCopied'; n: number; week: string }

// What the service worker shows. A newer notification with the same tag takes
// the place of an older one, so a phone holds one per room's list and plan.
export interface Notice {
  title: string
  body: string
  url: string
  tag: string
}

// A run of changes of one group, by one member, notifies the others once (see
// push_notices). Finishing the shop is its own group, so it still gets through
// straight after adding things.
export type NoticeGroup = 'list' | 'done' | 'plan'
export function noticeGroup(change: RoomChange): NoticeGroup {
  if (change.kind === 'listDone') return 'done'
  return change.kind.startsWith('list') ? 'list' : 'plan'
}

// "Tuesday dinner" / "星期二晚餐", from a YYYY-MM-DD date.
function when(locale: Locale, date: string, slot: MealSlot): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return translate(locale, 'push.when', {
    day: translate(locale, `weekday.${day}`),
    slot: translate(locale, `push.slot.${slot}`),
  })
}

export function roomNotice(
  change: RoomChange,
  { locale, who, room, roomId }: { locale: Locale; who: string | null; room: string; roomId: string },
): Notice {
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars)
  const name = who?.trim() || t('push.someone')
  const onList = change.kind.startsWith('list')
  const base = { title: t(onList ? 'push.listTitle' : 'push.planTitle', { room }), tag: `${onList ? 'list' : 'plan'}:${roomId}` }
  const list = `/rooms/${roomId}/shopping-list`
  const plan = (date: string) => `/rooms/${roomId}/plan?week=${date}`

  switch (change.kind) {
    case 'listItem':
      return { ...base, url: list, body: t('push.listItem', { who: name, item: change.item }) }
    case 'listRecipe':
      return { ...base, url: list, body: t('push.listRecipe', { who: name, recipe: change.recipe }) }
    case 'listWeek':
      return { ...base, url: list, body: t('push.listWeek', { who: name }) }
    case 'listDone':
      return { ...base, url: list, body: t('push.listDone', { who: name, n: change.n }) }
    case 'planCopied':
      return { ...base, url: plan(change.week), body: t('push.planCopied', { who: name, n: change.n }) }
    case 'planAdded':
    case 'planMoved':
    case 'planRemoved':
      return {
        ...base,
        url: plan(change.date),
        body: t(`push.${change.kind}`, { who: name, recipe: change.recipe, when: when(locale, change.date, change.slot) }),
      }
  }
}
