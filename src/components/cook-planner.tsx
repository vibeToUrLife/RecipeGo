'use client'
import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { setPantryItemAction } from '@/app/cook/actions'
import { matchRecipes, normalizeIng, type RecipeIngredients } from '@/lib/cook/match'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

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
  const [draft, setDraft] = useState('')
  const [, startTransition] = useTransition()

  // normalized name -> nice display label (recipe casing if known, else title-cased)
  const displayOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const label of universe) m.set(normalizeIng(label), label)
    return (n: string) => m.get(n) ?? titleCase(n)
  }, [universe])

  const { ready, almost } = useMemo(() => matchRecipes(recipes, [...have]), [recipes, have])

  function persist(key: string, present: boolean, revert: () => void) {
    startTransition(async () => {
      try {
        await setPantryItemAction(key, present)
      } catch {
        toast.error('Could not save your ingredients — please try again.')
        revert()
      }
    })
  }

  function add(name: string) {
    const key = normalizeIng(name)
    if (!key || have.has(key)) return
    setHave((prev) => new Set(prev).add(key))
    persist(key, true, () =>
      setHave((prev) => {
        const n = new Set(prev)
        n.delete(key)
        return n
      }),
    )
  }

  function remove(key: string) {
    if (!have.has(key)) return
    setHave((prev) => {
      const n = new Set(prev)
      n.delete(key)
      return n
    })
    persist(key, false, () => setHave((prev) => new Set(prev).add(key)))
  }

  function onAdd() {
    const v = draft.trim()
    if (!v) return
    add(v)
    setDraft('')
  }

  const haveList = [...have].sort((a, b) => displayOf(a).localeCompare(displayOf(b)))
  const suggestions = universe.filter((label) => !have.has(normalizeIng(label)))

  return (
    <div className="space-y-8">
      {/* Your ingredients — type to add (always available) */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          Ingredients I have ({have.size})
        </h2>
        <div className="mb-3 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onAdd()
              }
            }}
            placeholder="Add an ingredient you have — e.g. eggs"
          />
          <Button type="button" onClick={onAdd}>Add</Button>
        </div>
        {haveList.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Type an ingredient and press Add (or Enter). Add a few and we&apos;ll match them to your recipes below.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {haveList.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => remove(key)}
                aria-label={`Remove ${displayOf(key)}`}
                className="rounded-full border border-primary bg-primary px-3 py-1 text-sm text-primary-foreground hover:opacity-90"
              >
                {displayOf(key)} ✕
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Quick add — exact ingredient names from your recipes (ensures matches) */}
      {suggestions.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Quick add (ingredients from your recipes)
          </h2>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => add(label)}
                className="rounded-full border border-border bg-background px-3 py-1 text-sm hover:bg-muted"
              >
                + {label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Matches */}
      {recipes.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No recipes here yet — add some recipes and we&apos;ll show which ones you can cook from your ingredients.
          </p>
        </div>
      ) : (
        <>
          <section>
            <h2 className="mb-2 font-serif text-lg text-primary">✅ Ready to cook ({ready.length})</h2>
            {ready.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add the ingredients you have above — recipes you can make right now will appear here.
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
        </>
      )}
    </div>
  )
}
