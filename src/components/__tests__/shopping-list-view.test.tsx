import { render, screen, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ShoppingListView } from '@/components/shopping-list-view'
import { updateItemNameAction } from '@/app/shopping-list/actions'
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
