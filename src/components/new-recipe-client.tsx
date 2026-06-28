'use client'
import { useState } from 'react'
import { ImportBar } from '@/components/import-bar'
import { RecipeForm } from '@/components/recipe-form'
import type { ImportedRecipe } from '@/lib/recipe/types'

export function NewRecipeClient() {
  const [imported, setImported] = useState<ImportedRecipe | null>(null)
  return (
    <>
      <ImportBar onImported={setImported} />
      <RecipeForm key={imported?.sourceUrl ?? 'blank'} imported={imported} />
    </>
  )
}
