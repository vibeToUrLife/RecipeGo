import { render, screen, waitFor, within, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ShoppingListView } from '@/components/shopping-list-view'
import { clearShoppingListAction, updateItemNameAction, updateItemQuantityAction } from '@/app/shopping-list/actions'
import { toast } from 'sonner'
import type { ShoppingListRow } from '@/lib/data/shopping'

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
