'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addToListAction } from '@/app/shopping-list/actions'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function AddToListButton({
  recipeId,
  servings,
  recipeRoomId,
}: {
  recipeId: string
  servings: number
  recipeRoomId?: string | null
}) {
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={() => start(async () => {
        try {
          await addToListAction(recipeId, servings)
          toast.success('Added to shopping list')
          router.push(recipeRoomId ? `/rooms/${recipeRoomId}/shopping-list` : '/shopping-list')
        } catch {
          toast.error('Failed to add to shopping list')
        }
      })}
    >
      🛒 {pending ? 'Adding…' : 'Add ingredients to shopping list'}
    </Button>
  )
}
