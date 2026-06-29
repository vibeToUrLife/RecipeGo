'use client'
import { useState } from 'react'
import { ImportBar } from '@/components/import-bar'
import { RecipeForm } from '@/components/recipe-form'
import type { ImportedRecipe } from '@/lib/recipe/types'
import type { Room } from '@/lib/db-types'

export function NewRecipeClient({ rooms, defaultRoomId }: { rooms: Room[]; defaultRoomId: string | null }) {
  const [imported, setImported] = useState<ImportedRecipe | null>(null)
  return (
    <>
      <ImportBar onImported={setImported} />
      <RecipeForm key={imported?.sourceUrl ?? 'blank'} imported={imported} rooms={rooms} defaultRoomId={defaultRoomId} />
    </>
  )
}
