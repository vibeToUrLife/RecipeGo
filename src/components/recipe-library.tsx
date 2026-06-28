'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Recipe } from '@/lib/db-types'
import { RecipeCard } from '@/components/recipe-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function RecipeLibrary({ recipes }: { recipes: Recipe[] }) {
  const [q, setQ] = useState('')
  const filtered = recipes.filter((r) => r.title.toLowerCase().includes(q.toLowerCase()))

  if (recipes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-lg">No recipes yet.</p>
        <p className="mb-4 text-sm text-muted-foreground">Add your first recipe or import one from a URL.</p>
        <Button asChild><Link href="/recipes/new">＋ Add a recipe</Link></Button>
      </div>
    )
  }

  return (
    <>
      <Input placeholder="🔍 Search recipes…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recipes match "{q}".</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {filtered.map((r) => <RecipeCard key={r.id} recipe={r} />)}
        </div>
      )}
    </>
  )
}
