'use client'
import { useState, useTransition } from 'react'
import { removeRecipe } from '@/app/recipes/actions'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'

export function DeleteRecipeButton({ recipeId }: { recipeId: string }) {
  const t = useT()
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>{t('common.delete')}</Button>
    )
  }
  return (
    <div className="flex gap-2">
      <Button
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => start(async () => { await removeRecipe(recipeId) })}
      >
        {pending ? t('detail.deleting') : t('detail.confirmDelete')}
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>{t('common.cancel')}</Button>
    </div>
  )
}
