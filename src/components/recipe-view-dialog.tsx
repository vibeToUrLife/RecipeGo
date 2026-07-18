'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ServingsStepper } from '@/components/servings-stepper'
import { getPlannedRecipeAction } from '@/app/plan/actions'
import { scaleIngredients } from '@/lib/scaling'
import { publicImageUrl } from '@/lib/image-url'
import type { RecipeWithChildren } from '@/lib/db-types'
import type { IngredientInput } from '@/lib/types'
import { useT } from '@/components/i18n-provider'

function fmtQty(q: number | null) {
  if (q === null) return ''
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, '')
}

// A read-only recipe view shown in a modal from a planned meal — lets you check
// the ingredients and method without leaving the plan. Fetches the full recipe
// on mount (the plan grid only has titles) and scales quantities to the number
// of people this meal is planned for. The parent mounts this only while open, so
// each open starts fresh — no state to reset and no synchronous setState churn.
export function RecipeViewDialog({
  recipeId,
  title,
  plannedServings,
  onClose,
}: {
  recipeId: string
  title: string
  plannedServings: number
  onClose: () => void
}) {
  const t = useT()
  const [recipe, setRecipe] = useState<RecipeWithChildren | null>(null)
  const [loading, setLoading] = useState(true)
  const [servings, setServings] = useState(plannedServings)

  useEffect(() => {
    let active = true
    getPlannedRecipeAction(recipeId)
      .then((r) => { if (active) setRecipe(r) })
      .catch(() => { if (active) toast.error(t('plan.recipeLoadFailed')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [recipeId, t])

  const scaled = recipe
    ? scaleIngredients(
        recipe.ingredients.map((i): IngredientInput => ({
          name: i.name, quantity: i.quantity, unit: i.unit, category: i.category,
        })),
        recipe.servings,
        servings,
      )
    : []
  const total = recipe ? (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0) : 0
  const img = recipe ? publicImageUrl(recipe.image_path) : null

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[85vh] gap-3 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-primary">{recipe?.title ?? title}</DialogTitle>
        </DialogHeader>

        {loading && !recipe ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : !recipe ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('plan.recipeLoadFailed')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-accent/40 to-primary/30 text-5xl">
              {img
                ? <Image src={img} alt={recipe.title} fill className="object-cover" sizes="(max-width: 640px) 100vw, 32rem" />
                : <span>🍽️</span>}
            </div>

            {recipe.description && <p className="text-sm text-muted-foreground">{recipe.description}</p>}
            {(total > 0 || recipe.difficulty) && (
              <p className="text-sm text-muted-foreground">
                {total > 0 ? `⏱ ${t('detail.min', { n: total })}` : ''}
                {recipe.difficulty ? ` · ${recipe.difficulty}` : ''}
              </p>
            )}

            <ServingsStepper value={servings} onChange={setServings} />

            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">{t('detail.ingredients')}</h2>
              <ul className="space-y-1 text-sm">
                {scaled.map((ing, idx) => (
                  <li key={idx} className="border-b py-1">
                    {fmtQty(ing.quantity)} {ing.unit ? t('unit.' + ing.unit) : ''} {ing.name}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">{t('detail.method')}</h2>
              <ol className="space-y-3 text-sm">
                {recipe.steps.map((s) => {
                  const stepImg = publicImageUrl(s.image_path)
                  return (
                    <li key={s.id} className="flex gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs">{s.step_number}</span>
                      <div className="flex-1 space-y-2">
                        <span>{s.text}</span>
                        {stepImg && (
                          <Image src={stepImg} alt="" width={480} height={300} className="w-full rounded-lg object-cover" />
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
