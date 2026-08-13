'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addToListAction } from '@/app/shopping-list/actions'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useT } from '@/components/i18n-provider'

export function AddToListButton({
  recipeId,
  servings,
  recipeRoomId,
  onAdded,
}: {
  recipeId: string
  servings: number
  recipeRoomId?: string | null
  // Callers that render this inside a modal use it to dismiss themselves, so
  // the dialog doesn't sit over the shopping list we're about to navigate to.
  onAdded?: () => void
}) {
  const t = useT()
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={() => start(async () => {
        try {
          await addToListAction(recipeId, servings)
          toast.success(t('detail.addedToList'))
          onAdded?.()
          router.push(recipeRoomId ? `/rooms/${recipeRoomId}/shopping-list` : '/shopping-list')
        } catch {
          toast.error(t('detail.addToListFailed'))
        }
      })}
    >
      {pending ? t('detail.addingToList') : t('detail.addToList')}
    </Button>
  )
}
