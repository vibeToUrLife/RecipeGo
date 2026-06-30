'use client'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { addShoppingItemAction } from '@/app/shopping-list/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function AddShoppingItem({ roomId }: { roomId: string | null }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'food' | 'other'>('food')
  const [pending, startTransition] = useTransition()

  function add() {
    const v = name.trim()
    if (!v) return
    startTransition(async () => {
      const res = await addShoppingItemAction(roomId, v, kind === 'food')
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success('Added to your list.')
        setName('')
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
        placeholder="Add an extra item — e.g. milk, toilet paper"
        className="min-w-[12rem] flex-1"
        disabled={pending}
      />
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as 'food' | 'other')}
        disabled={pending}
        aria-label="Item type"
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
      >
        <option value="food">🍎 Food</option>
        <option value="other">🧺 Daily / other</option>
      </select>
      <Button type="button" onClick={add} disabled={pending}>{pending ? 'Adding…' : 'Add'}</Button>
    </div>
  )
}
