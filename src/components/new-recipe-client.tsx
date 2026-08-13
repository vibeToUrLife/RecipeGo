'use client'
import { useState } from 'react'
import { ImportBar } from '@/components/import-bar'
import { RecipeForm } from '@/components/recipe-form'
import type { ImportedRecipe } from '@/lib/recipe/types'
import type { Room } from '@/lib/db-types'
import { useT } from '@/components/i18n-provider'

export function NewRecipeClient({ rooms, defaultRoomId }: { rooms: Room[]; defaultRoomId: string | null }) {
  const [imported, setImported] = useState<ImportedRecipe | null>(null)
  const t = useT()
  return (
    <>
      <ImportBar onImported={setImported} />
      <div className="mb-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t('form.orManual')}
        <span className="h-px flex-1 bg-border" />
      </div>
      <RecipeForm key={imported?.sourceUrl ?? 'blank'} imported={imported} rooms={rooms} defaultRoomId={defaultRoomId} />
    </>
  )
}
