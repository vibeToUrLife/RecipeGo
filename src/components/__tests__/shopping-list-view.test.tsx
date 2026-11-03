import { render, screen, waitFor, within, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ShoppingListView } from '@/components/shopping-list-view'
import {
  clearShoppingListAction,
  completeShoppingAction,
  refreshListAction,
  removeItemAction,
  toggleItemAction,
  updateItemNameAction,
  updateItemQuantityAction,
} from '@/app/shopping-list/actions'
import { toast } from 'sonner'
import type { ShoppingListRow } from '@/lib/data/shopping'
import { forgetTick, rememberTick, unsentTicks } from '@/lib/offline-list'

vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
vi.mock('@/app/shopping-list/actions', () => ({
  toggleItemAction: vi.fn(),
  removeItemAction: vi.fn(),
  completeShoppingAction: vi.fn(),
  clearShoppingListAction: vi.fn(),
  addShoppingItemAction: vi.fn(),
  updateItemQuantityAction: vi.fn(),
  updateItemNameAction: vi.fn(),
  refreshListAction: vi.fn(),
}))

const row = (over: Partial<ShoppingListRow> = {}): ShoppingListRow => ({
  id: 'it1',
  name: 'carrot',
  total_quantity: 2,
  unit: null,
  category: 'Produce',
  checked: false,
  source_recipe_ids: [],
  is_food: true,
  room_id: null,
  ...over,
})

beforeEach(() => {
  vi.mocked(updateItemNameAction).mockReset()
  vi.mocked(updateItemNameAction).mockResolvedValue({ ok: true })
  vi.mocked(updateItemQuantityAction).mockReset()
  vi.mocked(updateItemQuantityAction).mockResolvedValue({ ok: true })
  vi.mocked(clearShoppingListAction).mockReset()
  vi.mocked(clearShoppingListAction).mockResolvedValue(undefined)
  vi.mocked(toast.error).mockClear()
})

// The name reads as a button until it's clicked; the field carries an aria-label.
const nameButton = (text: string) => screen.getByRole('button', { name: text })
const nameField = () => screen.getByLabelText('shop.editName')

async function renameTo(from: string, to: string, key = '{Enter}') {
  await userEvent.click(nameButton(from))
  const field = nameField()
  await userEvent.clear(field)
  await userEvent.type(field, `${to}${key}`)
}

// Holds the rename in flight so the optimistic list can be inspected before
// useOptimistic hands back to the (unchanged, in a test) server state.
function pendingRename() {
  let release!: () => void
  vi.mocked(updateItemNameAction).mockImplementation(
    () => new Promise((res) => { release = () => res({ ok: true }) }),
  )
  return async () => { await act(async () => { release() }) }
}

describe('ShoppingListView inline rename', () => {
  it('turns the name into a field on click and saves it on Enter', async () => {
    const { rerender } = render(<ShoppingListView items={[row()]} />)
    expect(screen.queryByLabelText('shop.editName')).toBeNull()

    await renameTo('carrot', 'potato')

    await waitFor(() => expect(updateItemNameAction).toHaveBeenCalledWith('it1', 'potato'))
    // Field closes again once committed…
    await waitFor(() => expect(screen.queryByLabelText('shop.editName')).toBeNull())
    // …and the revalidated list from the server is what the row settles on.
    rerender(<ShoppingListView items={[row({ name: 'potato' })]} />)
    expect(nameButton('potato')).toBeInTheDocument()
  })

  it('re-files a renamed food item under its new aisle right away', async () => {
    const finish = pendingRename()
    render(<ShoppingListView items={[row()]} />)
    expect(screen.getByRole('heading', { name: 'aisle.Produce' })).toBeInTheDocument()

    await renameTo('carrot', 'chicken thigh')

    // Optimistic: the row moves aisle without waiting on the server.
    const meat = await screen.findByRole('heading', { name: 'aisle.Meat & Seafood' })
    expect(within(meat.closest('section')!).getByRole('button', { name: 'chicken thigh' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'aisle.Produce' })).toBeNull()
    await finish()
  })

  it('leaves a daily item where it is — those are always Other', async () => {
    const finish = pendingRename()
    render(<ShoppingListView items={[row({ name: 'bin bags', is_food: false, category: 'Other' })]} />)

    await renameTo('bin bags', 'milk bottles')

    await waitFor(() => expect(nameButton('milk bottles')).toBeInTheDocument())
    // The "milk" keyword must not drag a non-food row into Dairy & Eggs.
    expect(screen.queryByRole('heading', { name: 'aisle.Dairy & Eggs' })).toBeNull()
    expect(screen.getByText('shop.dailyHeading')).toBeInTheDocument()
    await finish()
  })

  it('reverts on Escape without saving', async () => {
    render(<ShoppingListView items={[row()]} />)
    await renameTo('carrot', 'potato', '{Escape}')

    await waitFor(() => expect(nameButton('carrot')).toBeInTheDocument())
    expect(updateItemNameAction).not.toHaveBeenCalled()
  })

  it('refuses to blank out a name', async () => {
    render(<ShoppingListView items={[row()]} />)
    await userEvent.click(nameButton('carrot'))
    await userEvent.clear(nameField())
    await userEvent.tab() // blur commits

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('shop.enterName'))
    expect(updateItemNameAction).not.toHaveBeenCalled()
    expect(nameButton('carrot')).toBeInTheDocument()
  })

  it('does not call the server when the name is unchanged', async () => {
    render(<ShoppingListView items={[row()]} />)
    await userEvent.click(nameButton('carrot'))
    await userEvent.tab()

    await waitFor(() => expect(nameButton('carrot')).toBeInTheDocument())
    expect(updateItemNameAction).not.toHaveBeenCalled()
  })

  it('keeps the checked row struck through while it is still editable', async () => {
    render(<ShoppingListView items={[row({ checked: true })]} />)
    expect(nameButton('carrot')).toHaveClass('line-through')
    await userEvent.click(nameButton('carrot'))
    expect(nameField()).toBeInTheDocument()
  })
})

describe('ShoppingListView clear all', () => {
  const twoRows = [
    row(),
    row({ id: 'it2', name: 'bin bags', is_food: false, category: 'Other', checked: true }),
  ]
  const clearAll = () => screen.getByRole('button', { name: 'shop.clearAll' })
  const confirm = () => screen.getByRole('button', { name: 'shop.confirmClearAll' })

  it('asks first, then empties the whole list, ticked or not', async () => {
    let release!: () => void
    vi.mocked(clearShoppingListAction).mockImplementation(
      () => new Promise((res) => { release = () => res(undefined) }),
    )
    const { rerender } = render(<ShoppingListView items={twoRows} />)

    await userEvent.click(clearAll())
    expect(clearShoppingListAction).not.toHaveBeenCalled()

    await userEvent.click(confirm())
    expect(clearShoppingListAction).toHaveBeenCalledWith(null)
    // Optimistic: the list empties without waiting on the server.
    expect(screen.getByText('shop.empty')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'carrot' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'bin bags' })).toBeNull()

    await act(async () => { release() })
    rerender(<ShoppingListView items={[]} />)
    expect(screen.getByText('shop.empty')).toBeInTheDocument()
  })

  it("clears the room's list on a room page", async () => {
    render(<ShoppingListView items={[row({ room_id: 'room-1' })]} roomId="room-1" />)
    await userEvent.click(clearAll())
    await userEvent.click(confirm())
    expect(clearShoppingListAction).toHaveBeenCalledWith('room-1')
  })

  it('backs out on Cancel', async () => {
    render(<ShoppingListView items={twoRows} />)
    await userEvent.click(clearAll())
    const cancel = screen.getByRole('button', { name: 'common.cancel' })
    expect(cancel).toHaveFocus() // the safe choice, not the destructive one
    await userEvent.click(cancel)

    expect(clearShoppingListAction).not.toHaveBeenCalled()
    expect(clearAll()).toBeInTheDocument()
    expect(nameButton('carrot')).toBeInTheDocument()
  })

  it('brings the items back and says so when clearing fails', async () => {
    vi.mocked(clearShoppingListAction).mockRejectedValue(new Error('offline'))
    render(<ShoppingListView items={twoRows} />)
    await userEvent.click(clearAll())
    await userEvent.click(confirm())

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('shop.clearFailed'))
    expect(await screen.findByRole('button', { name: 'carrot' })).toBeInTheDocument()
    expect(nameButton('bin bags')).toBeInTheDocument()
  })

  it('is not offered when the list is already empty', () => {
    render(<ShoppingListView items={[]} />)
    expect(screen.queryByRole('button', { name: 'shop.clearAll' })).toBeNull()
  })
})

describe('ShoppingListView quantity − / +', () => {
  const minus = () => screen.getByRole('button', { name: 'shop.decQtyAria' })
  const plus = () => screen.getByRole('button', { name: 'shop.incQtyAria' })
  const qtyField = () => screen.getByLabelText('shop.editQtyAria')

  it('+ adds one, shows it at once and saves it', async () => {
    let release!: () => void
    vi.mocked(updateItemQuantityAction).mockImplementation(
      () => new Promise((res) => { release = () => res({ ok: true }) }),
    )
    render(<ShoppingListView items={[row({ total_quantity: 2 })]} />)

    await userEvent.click(plus())

    expect(updateItemQuantityAction).toHaveBeenCalledWith('it1', 3)
    expect(qtyField()).toHaveValue(3)
    await act(async () => { release() })
  })

  it('− takes one off', async () => {
    render(<ShoppingListView items={[row({ total_quantity: 3 })]} />)
    await userEvent.click(minus())
    expect(updateItemQuantityAction).toHaveBeenCalledWith('it1', 2)
  })

  it('− stops at 1 — taking an item off the list is ✕', async () => {
    const { rerender } = render(<ShoppingListView items={[row({ total_quantity: 1 })]} />)
    expect(minus()).toBeDisabled()

    // From a fraction above 1 it lands on 1 rather than going under.
    rerender(<ShoppingListView items={[row({ total_quantity: 1.5 })]} />)
    await userEvent.click(minus())
    expect(updateItemQuantityAction).toHaveBeenCalledWith('it1', 1)
  })

  it('+ starts an unspecified quantity at 1', async () => {
    render(<ShoppingListView items={[row({ total_quantity: null })]} />)
    expect(minus()).toBeDisabled()
    await userEvent.click(plus())
    expect(updateItemQuantityAction).toHaveBeenCalledWith('it1', 1)
  })

  it('+ stops at the 100000 cap', () => {
    render(<ShoppingListView items={[row({ total_quantity: 100000 })]} />)
    expect(plus()).toBeDisabled()
    expect(minus()).toBeEnabled()
  })

  it('counts on from a number typed but not yet saved', async () => {
    render(<ShoppingListView items={[row({ total_quantity: 2 })]} />)
    await userEvent.clear(qtyField())
    await userEvent.type(qtyField(), '5')

    await userEvent.click(plus())

    // Leaving the field saves the 5; + then steps from it, not from the old 2.
    expect(updateItemQuantityAction).toHaveBeenNthCalledWith(1, 'it1', 5)
    expect(updateItemQuantityAction).toHaveBeenNthCalledWith(2, 'it1', 6)
  })

  it('counts on from the typed number when the click leaves focus in the field', async () => {
    render(<ShoppingListView items={[row({ total_quantity: 2 })]} />)
    await userEvent.clear(qtyField())
    await userEvent.type(qtyField(), '5')

    // No blur this time, so nothing has saved the 5 before + runs.
    fireEvent.click(plus())

    expect(updateItemQuantityAction).toHaveBeenCalledTimes(1)
    expect(updateItemQuantityAction).toHaveBeenCalledWith('it1', 6)
  })
})

describe('ShoppingListView sharing', () => {
  const shareButton = () => screen.getByRole('button', { name: 'shop.share' })
  const restore: (() => void)[] = []
  // Give the browser a share sheet, or a clipboard, for one test.
  function stub<K extends 'share' | 'clipboard'>(key: K, value: unknown) {
    const before = Object.getOwnPropertyDescriptor(navigator, key)
    Object.defineProperty(navigator, key, { value, configurable: true })
    restore.push(() => (before ? Object.defineProperty(navigator, key, before) : delete (navigator as unknown as Record<string, unknown>)[key]))
  }
  beforeEach(() => { while (restore.length) restore.pop()!() })

  it('sends what’s left to buy through the share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    stub('share', share)
    render(<ShoppingListView items={[row({ name: 'carrot' }), row({ id: 'it2', name: 'leek', checked: true })]} />)
    fireEvent.click(shareButton())

    await waitFor(() => expect(share).toHaveBeenCalled())
    const { title, text } = share.mock.calls[0][0]
    expect(title).toBe('shop.title')
    expect(text).toContain('- carrot 2')
    expect(text).not.toContain('leek')
  })

  it('says nothing when the share sheet is closed without sending', async () => {
    stub('share', vi.fn().mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'AbortError' })))
    render(<ShoppingListView items={[row()]} />)
    fireEvent.click(shareButton())
    await waitFor(() => expect(navigator.share).toHaveBeenCalled())
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('copies the list where there’s no share sheet', async () => {
    stub('share', undefined)
    const writeText = vi.fn().mockResolvedValue(undefined)
    stub('clipboard', { writeText })
    render(<ShoppingListView items={[row({ name: 'carrot' })]} />)
    fireEvent.click(shareButton())

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('shop.listCopied'))
    expect(writeText.mock.calls[0][0]).toContain('- carrot 2')
  })

  it('has nothing to share once everything is ticked', () => {
    render(<ShoppingListView items={[row({ checked: true })]} />)
    expect(shareButton()).toBeDisabled()
  })
})

describe('ShoppingListView with no signal', () => {
  let online = true
  const box = () => screen.getByRole('checkbox')
  const status = () => screen.queryByRole('status')
  const goOnline = (on: boolean) => {
    online = on
    act(() => { window.dispatchEvent(new Event(on ? 'online' : 'offline')) })
  }
  const noSignal = () => new TypeError('Load failed')

  beforeEach(() => {
    online = true
    Object.defineProperty(navigator, 'onLine', { get: () => online, configurable: true })
    for (const id of Object.keys(unsentTicks())) forgetTick(id)
    vi.mocked(toggleItemAction).mockReset()
    vi.mocked(toggleItemAction).mockResolvedValue(undefined)
    vi.mocked(completeShoppingAction).mockReset()
    vi.mocked(completeShoppingAction).mockResolvedValue({ saved: 0, cleared: 1 })
    vi.mocked(removeItemAction).mockReset()
    vi.mocked(refreshListAction).mockReset()
    vi.mocked(refreshListAction).mockResolvedValue(undefined)
  })
  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).onLine
    vi.useRealTimers()
  })

  it('keeps a tick on the phone, and says so', async () => {
    online = false
    render(<ShoppingListView items={[row()]} />)
    expect(status()).toHaveTextContent('shop.offline')

    fireEvent.click(box())

    await waitFor(() => expect(unsentTicks()).toEqual({ it1: true }))
    expect(box()).toBeChecked()
    expect(toggleItemAction).not.toHaveBeenCalled()
  })

  it('sends the kept ticks once the signal is back', async () => {
    online = false
    const { rerender } = render(<ShoppingListView items={[row()]} />)
    fireEvent.click(box())
    await waitFor(() => expect(unsentTicks()).toEqual({ it1: true }))

    goOnline(true)

    await waitFor(() => expect(toggleItemAction).toHaveBeenCalledWith('it1', true))
    await waitFor(() => expect(unsentTicks()).toEqual({}))
    rerender(<ShoppingListView items={[row({ checked: true })]} />) // the list as the server now has it
    expect(box()).toBeChecked()
    expect(status()).toBeNull()
  })

  it('keeps a tick that could not be sent, shown ticked and waiting', async () => {
    vi.mocked(toggleItemAction).mockRejectedValue(noSignal())
    render(<ShoppingListView items={[row()]} />)

    fireEvent.click(box())

    await waitFor(() => expect(status()).toHaveTextContent('shop.unsentTicks'))
    expect(unsentTicks()).toEqual({ it1: true })
    expect(box()).toBeChecked()
  })

  it('tries again every 20 seconds while a weak signal keeps failing', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    vi.mocked(toggleItemAction).mockRejectedValue(noSignal())
    render(<ShoppingListView items={[row()]} />)
    fireEvent.click(box())
    await waitFor(() => expect(unsentTicks()).toEqual({ it1: true }))
    const tries = vi.mocked(toggleItemAction).mock.calls.length

    vi.mocked(toggleItemAction).mockResolvedValue(undefined)
    await act(async () => { vi.advanceTimersByTime(20_000) })

    await waitFor(() => expect(unsentTicks()).toEqual({}))
    expect(toggleItemAction).toHaveBeenCalledTimes(tries + 1)
  })

  it('shows ticks kept from before when the list opens, and sends them', async () => {
    rememberTick('it1', true)
    render(<ShoppingListView items={[row()]} />)

    expect(box()).toBeChecked()
    await waitFor(() => expect(toggleItemAction).toHaveBeenCalledWith('it1', true))
    await waitFor(() => expect(unsentTicks()).toEqual({}))
  })

  it('lets a tick sent now replace one still waiting', async () => {
    vi.mocked(toggleItemAction).mockRejectedValue(noSignal())
    rememberTick('it1', true)
    render(<ShoppingListView items={[row()]} />)
    await waitFor(() => expect(toggleItemAction).toHaveBeenCalled()) // the waiting one fails again
    expect(box()).toBeChecked()

    vi.mocked(toggleItemAction).mockResolvedValue(undefined)
    fireEvent.click(box()) // untick

    await waitFor(() => expect(toggleItemAction).toHaveBeenLastCalledWith('it1', false))
    await waitFor(() => expect(unsentTicks()).toEqual({}))
  })

  it('sends the waiting ticks before finishing the shop', async () => {
    vi.mocked(toggleItemAction).mockRejectedValue(noSignal())
    rememberTick('it1', true)
    render(<ShoppingListView items={[row()]} />)
    await waitFor(() => expect(toggleItemAction).toHaveBeenCalled())
    const tries = vi.mocked(toggleItemAction).mock.calls.length

    vi.mocked(toggleItemAction).mockResolvedValue(undefined)
    fireEvent.click(screen.getByRole('button', { name: 'shop.done' }))

    await waitFor(() => expect(completeShoppingAction).toHaveBeenCalledWith(null))
    const { calls, invocationCallOrder } = vi.mocked(toggleItemAction).mock
    expect(calls.slice(tries)).toEqual([['it1', true]])
    expect(invocationCallOrder[tries]).toBeLessThan(vi.mocked(completeShoppingAction).mock.invocationCallOrder[0])
  })

  it('does not finish the shop while ticks still cannot be sent', async () => {
    vi.mocked(toggleItemAction).mockRejectedValue(noSignal())
    rememberTick('it1', true)
    render(<ShoppingListView items={[row()]} />)

    fireEvent.click(screen.getByRole('button', { name: 'shop.done' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('shop.completeFailed'))
    expect(completeShoppingAction).not.toHaveBeenCalled()
    expect(unsentTicks()).toEqual({ it1: true })
  })

  it('says so when an item cannot be removed, and brings it back', async () => {
    vi.mocked(removeItemAction).mockRejectedValue(noSignal())
    render(<ShoppingListView items={[row()]} />)

    fireEvent.click(screen.getByRole('button', { name: '✕' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('shop.removeFailed'))
    await waitFor(() => expect(nameButton('carrot')).toBeInTheDocument())
  })

  it('asks the service worker to keep a copy once the list has settled', async () => {
    const postMessage = vi.fn()
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ active: { postMessage } }) },
      configurable: true,
    })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { rerender } = render(<ShoppingListView items={[row()]} />)
      rerender(<ShoppingListView items={[row({ checked: true })]} />) // a change starts the wait again
      await act(async () => { vi.advanceTimersByTime(1999) })
      expect(postMessage).not.toHaveBeenCalled()

      await act(async () => { vi.advanceTimersByTime(1) })
      expect(postMessage).toHaveBeenCalledTimes(1)
      expect(postMessage).toHaveBeenCalledWith({ type: 'keep', path: location.pathname })
    } finally {
      delete (navigator as unknown as Record<string, unknown>).serviceWorker
    }
  })

  describe('catching up with the server', () => {
    const minutesAgo = (n: number) => Date.now() - n * 60_000

    it('leaves a list fresh from the server alone', async () => {
      render(<ShoppingListView items={[row()]} renderedAt={Date.now()} />)
      await act(async () => {})
      expect(refreshListAction).not.toHaveBeenCalled()
    })

    it('fetches the list afresh when the one opened is a copy kept earlier', async () => {
      render(<ShoppingListView items={[row()]} renderedAt={minutesAgo(5)} />)
      await waitFor(() => expect(refreshListAction).toHaveBeenCalledTimes(1))
    })

    it('waits for a signal to do so', async () => {
      online = false
      render(<ShoppingListView items={[row()]} renderedAt={minutesAgo(5)} />)
      await act(async () => {})
      expect(refreshListAction).not.toHaveBeenCalled()

      goOnline(true)
      await waitFor(() => expect(refreshListAction).toHaveBeenCalledTimes(1))
    })

    it('catches up on what others changed once the phone is back online', async () => {
      render(<ShoppingListView items={[row()]} renderedAt={Date.now()} />)
      goOnline(false)
      goOnline(true)
      await waitFor(() => expect(refreshListAction).toHaveBeenCalledTimes(1))
    })

    it('gives up quietly if the signal fails again', async () => {
      vi.mocked(refreshListAction).mockRejectedValue(noSignal())
      render(<ShoppingListView items={[row()]} renderedAt={minutesAgo(5)} />)
      await waitFor(() => expect(refreshListAction).toHaveBeenCalled())
      expect(box()).toBeInTheDocument()
      expect(toast.error).not.toHaveBeenCalled()
    })
  })
})
