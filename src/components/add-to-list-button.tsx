'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addToListAction } from '@/app/shopping-list/actions'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function AddToListButton({ recipeId, servings }: { recipeId: string; servings: number }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={() => start(async () => {
        await addToListAction(recipeId, servings)
        toast.success('Added to shopping list')
        router.push('/shopping-list')
      })}
    >
      🛒 {pending ? 'Adding…' : 'Add ingredients to shopping list'}
    </Button>
  )
}
