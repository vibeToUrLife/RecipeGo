'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Recipe } from '@/lib/db-types'
import { RecipeCard } from '@/components/recipe-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'

export function RecipeLibrary({ recipes, addHref = '/recipes/new' }: { recipes: Recipe[]; addHref?: string }) {
  const t = useT()
  const [q, setQ] = useState('')
  const filtered = recipes.filter((r) => r.title.toLowerCase().includes(q.toLowerCase()))

  if (recipes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-lg">{t('home.noRecipes')}</p>
        <p className="mb-4 text-sm text-muted-foreground">{t('home.noRecipesHint')}</p>
        <Button asChild><Link href={addHref}>＋ {t('home.addRecipe')}</Link></Button>
      </div>
    )
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Input placeholder={t('home.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Button asChild><Link href={addHref}>{t('lib.addRecipe')}</Link></Button>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('home.noMatch', { q })}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {filtered.map((r) => <RecipeCard key={r.id} recipe={r} />)}
        </div>
      )}
    </>
  )
}
