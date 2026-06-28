'use client'
import { useState, useTransition } from 'react'
import { removeRecipe } from '@/app/recipes/actions'
import { Button } from '@/components/ui/button'

export function DeleteRecipeButton({ recipeId }: { recipeId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>Delete</Button>
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
        {pending ? 'Deleting…' : 'Confirm delete'}
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>Cancel</Button>
    </div>
  )
}
