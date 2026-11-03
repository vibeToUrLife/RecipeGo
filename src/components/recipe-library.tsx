'use client'
import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import type { Recipe } from '@/lib/db-types'
import { RecipeCard } from '@/components/recipe-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'
import { DiceIcon, SearchIcon } from '@/components/icons'
import { pinnedHeight } from '@/lib/pinned-height'

// What's pinned above changes height only when the window does (the pill row
// goes into the header from lg up). On the server, a phone's header: 61px.
const onResize = (changed: () => void) => {
  window.addEventListener('resize', changed)
  return () => window.removeEventListener('resize', changed)
}

export function RecipeLibrary({ recipes, addHref = '/recipes/new', spinHref = '/spin' }: { recipes: Recipe[]; addHref?: string; spinHref?: string }) {
  const t = useT()
  const [q, setQ] = useState('')
  const filtered = recipes.filter((r) => r.title.toLowerCase().includes(q.toLowerCase()))
  const top = useSyncExternalStore(onResize, pinnedHeight, () => 61)

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
      {/* The search and its two buttons, kept to one line, stay pinned under the
          header (and a room's pill row) while you scroll down the recipes, on
          the page's colour so cards slide beneath unseen. -mt-2 cancels the
          padding it needs once pinned, so at rest nothing moves. */}
      <div
        style={{ top }}
        className="sticky z-10 -mx-4 -mt-2 mb-2 flex items-center justify-between gap-2 bg-background/80 px-4 py-2 backdrop-blur"
      >
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('home.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
        <div className="flex shrink-0 gap-2">
          {/* On a phone just the die, so the search beside it has room; the
              words are still there for a screen reader. */}
          <Button asChild variant="outline"><Link href={spinHref}><DiceIcon /><span className="max-sm:sr-only">{t('spin.button')}</span></Link></Button>
          <Button asChild><Link href={addHref}>{t('lib.addRecipe')}</Link></Button>
        </div>
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
