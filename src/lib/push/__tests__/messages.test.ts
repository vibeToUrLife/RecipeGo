import { describe, expect, it } from 'vitest'
import { noticeGroup, roomNotice, type RoomChange } from '@/lib/push/messages'

const ROOM = 'r1'
const say = (change: RoomChange, locale: 'en' | 'zh' = 'en', who: string | null = 'Alex') =>
  roomNotice(change, { locale, who, room: 'Southbay Kitchen', roomId: ROOM })

describe('roomNotice', () => {
  it('names the room and its list, and opens the list', () => {
    const notice = say({ kind: 'listItem', item: 'eggs' })
    expect(notice).toEqual({
      title: 'Southbay Kitchen · Shopping list',
      body: 'Alex added eggs',
      url: '/rooms/r1/shopping-list',
      tag: 'list:r1',
    })
  })

  it('says what was added to the list, and when the shop is done', () => {
    expect(say({ kind: 'listRecipe', recipe: 'Tomato and egg' }).body).toBe('Alex added the ingredients for Tomato and egg')
    expect(say({ kind: 'listWeek' }).body).toBe('Alex added the ingredients for the week’s meals')
    expect(say({ kind: 'listDone', n: 8 }).body).toBe('Alex finished the shopping: 8 item(s) bought')
  })

  it('says which meal changed on the plan, and opens that week', () => {
    const notice = say({ kind: 'planAdded', recipe: 'Mapo tofu', date: '2026-11-03', slot: 'dinner' })
    expect(notice.title).toBe('Southbay Kitchen · Meal plan')
    expect(notice.body).toBe('Alex planned Mapo tofu for Tuesday dinner')
    expect(notice.url).toBe('/rooms/r1/plan?week=2026-11-03')
    expect(notice.tag).toBe('plan:r1')
    expect(say({ kind: 'planMoved', recipe: 'Mapo tofu', date: '2026-11-05', slot: 'lunch' }).body).toBe('Alex moved Mapo tofu to Thursday lunch')
    expect(say({ kind: 'planRemoved', recipe: 'Congee', date: '2026-11-08', slot: 'breakfast' }).body).toBe('Alex took Congee off Sunday breakfast')
    const copied = say({ kind: 'planCopied', n: 12, week: '2026-11-02' })
    expect(copied.body).toBe('Alex copied 12 meal(s) from last week')
    expect(copied.url).toBe('/rooms/r1/plan?week=2026-11-02')
  })

  it('is written in the phone’s own language', () => {
    expect(say({ kind: 'listItem', item: '鸡蛋' }, 'zh')).toMatchObject({ title: 'Southbay Kitchen · 购物清单', body: 'Alex 加了 鸡蛋' })
    expect(say({ kind: 'listRecipe', recipe: '番茄炒蛋' }, 'zh').body).toBe('Alex 加了「番茄炒蛋」的食材')
    expect(say({ kind: 'listDone', n: 8 }, 'zh').body).toBe('Alex 买完了，买到 8 样')
    expect(say({ kind: 'planAdded', recipe: '麻婆豆腐', date: '2026-11-03', slot: 'dinner' }, 'zh')).toMatchObject({
      title: 'Southbay Kitchen · 计划',
      body: 'Alex 把「麻婆豆腐」排在了星期二晚餐',
    })
    expect(say({ kind: 'planRemoved', recipe: '粥', date: '2026-11-08', slot: 'breakfast' }, 'zh').body).toBe('Alex 去掉了星期日早餐的「粥」')
    expect(say({ kind: 'planCopied', n: 12, week: '2026-11-02' }, 'zh').body).toBe('Alex 把上周的 12 顿饭复制到了这周')
  })

  it('says “someone” for a member with no name', () => {
    expect(say({ kind: 'listWeek' }, 'en', null).body).toBe('Someone added the ingredients for the week’s meals')
    expect(say({ kind: 'listWeek' }, 'zh', '  ').body).toBe('有人 加了这周饭菜要用的食材')
  })
})

describe('noticeGroup', () => {
  it('groups additions to the list, the shop being done, and plan changes', () => {
    expect(noticeGroup({ kind: 'listItem', item: 'eggs' })).toBe('list')
    expect(noticeGroup({ kind: 'listRecipe', recipe: 'x' })).toBe('list')
    expect(noticeGroup({ kind: 'listWeek' })).toBe('list')
    expect(noticeGroup({ kind: 'listDone', n: 1 })).toBe('done')
    expect(noticeGroup({ kind: 'planAdded', recipe: 'x', date: '2026-11-03', slot: 'lunch' })).toBe('plan')
    expect(noticeGroup({ kind: 'planCopied', n: 2, week: '2026-11-02' })).toBe('plan')
  })
})
