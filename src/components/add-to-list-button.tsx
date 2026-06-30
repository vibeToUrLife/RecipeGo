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
}: {
  recipeId: string
  servings: number
  recipeRoomId?: string | null
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
