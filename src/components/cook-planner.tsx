'use client'
import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { setPantryItemAction } from '@/app/cook/actions'
import { matchRecipes, normalizeIng, type RecipeIngredients } from '@/lib/cook/match'

export function CookPlanner({
  recipes,
  universe,
  initialHave,
}: {
  recipes: RecipeIngredients[]
  universe: string[]
  initialHave: string[]
}) {
  const [have, setHave] = useState<Set<string>>(() => new Set(initialHave.map(normalizeIng)))
  const [, startTransition] = useTransition()

  // normalized name -> nice display label (from the recipe ingredient list)
  const displayOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const label of universe) m.set(normalizeIng(label), label)
    return (n: string) => m.get(n) ?? n
  }, [universe])

  const { ready, almost } = useMemo(() => matchRecipes(recipes, [...have]), [recipes, have])

  function toggle(label: string) {
    const key = normalizeIng(label)
    const present = !have.has(key)
    setHave((prev) => {
      const next = new Set(prev)
      if (present) next.add(key)
      else next.delete(key)
      return next
    })
    startTransition(async () => {
      try {
        await setPantryItemAction(key, present)
      } catch {
        toast.error('Could not save your pantry — please try again.')
        setHave((prev) => {
          const next = new Set(prev)
          if (present) next.delete(key)
          else next.add(key)
          return next
        })
      }
    })
  }

  if (universe.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-lg">No ingredients yet.</p>
        <p className="text-sm text-muted-foreground">Add a recipe or two first, then come back to see what you can cook.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Ingredient picker */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          Ingredients I have ({have.size})
        </h2>
        <div className="flex flex-wrap gap-2">
          {universe.map((label) => {
            const on = have.has(normalizeIng(label))
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggle(label)}
                aria-pressed={on}
                className={
                  'rounded-full border px-3 py-1 text-sm transition-colors ' +
                  (on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted')
                }
              >
                {on ? '✓ ' : ''}{label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Ready to cook */}
      <section>
        <h2 className="mb-2 font-serif text-lg text-primary">✅ Ready to cook ({ready.length})</h2>
        {ready.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tap the ingredients you have above — recipes you can make right now will appear here.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {ready.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/recipes/${r.id}`}
                  className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="font-medium">{r.title}</span>
                  <span className="text-xs text-muted-foreground">{r.total} ingredients</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Almost there */}
      {almost.length > 0 && (
        <section>
          <h2 className="mb-2 font-serif text-lg text-primary">🟡 Almost there ({almost.length})</h2>
          <ul className="space-y-2">
            {almost.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/recipes/${r.id}`}
                  className="block rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="font-medium">{r.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    missing {r.missing.length}: {r.missing.map(displayOf).join(', ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
