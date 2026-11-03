'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { RecipeWithChildren } from '@/lib/db-types'
import type { IngredientInput } from '@/lib/types'
import { AddToListButton } from '@/components/add-to-list-button'
import { DeleteRecipeButton } from '@/components/delete-recipe-button'
import { ShareRecipeButton } from '@/components/share-recipe-button'
import { PrintButton } from '@/components/print-button'
import { scaleIngredients } from '@/lib/scaling'
import { formatQuantity } from '@/lib/fraction'
import { publicImageUrl } from '@/lib/image-url'
import { Button } from '@/components/ui/button'
import { ServingsStepper } from '@/components/servings-stepper'
import { useT } from '@/components/i18n-provider'
import { ChefHatIcon, TimerIcon } from '@/components/icons'
import { RecipePhoto } from '@/components/recipe-photo'

export function RecipeDetail({ recipe }: { recipe: RecipeWithChildren }) {
  const t = useT()
  const [servings, setServings] = useState(recipe.servings)
  const img = publicImageUrl(recipe.image_path)

  const baseIngredients: IngredientInput[] = recipe.ingredients.map((i) => ({
    name: i.name, quantity: i.quantity, unit: i.unit, category: i.category,
  }))
  const scaled = scaleIngredients(baseIngredients, recipe.servings, servings)
  const total = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0)

  return (
    <article>
      {/* A photo gets a 4:3 frame, short of most of a phone screen, and shows
          whole within it. Without one this is just the placeholder — half a
          printed page of nothing, so keep it off the sheet. */}
      <RecipePhoto
        src={img}
        alt={recipe.title}
        sizes="(max-width: 768px) 100vw, 768px"
        className={img
          ? 'mb-4 aspect-[4/3] max-h-[min(70vh,28rem)] w-full rounded-2xl print:aspect-auto print:h-40'
          : 'mb-4 h-48 rounded-2xl print:hidden'}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <h1 className="font-serif text-3xl text-primary">{recipe.title}</h1>
        <div className="flex shrink-0 flex-wrap gap-2 print:hidden">
          <PrintButton label={t('print.recipe')} hint={t('print.hint')} />
          <ShareRecipeButton recipeId={recipe.id} />
          <Button asChild variant="outline" size="sm"><Link href={`/recipes/${recipe.id}/edit`}>{t('common.edit')}</Link></Button>
          <DeleteRecipeButton recipeId={recipe.id} />
        </div>
      </div>
      {recipe.description && <p className="mt-1 text-muted-foreground">{recipe.description}</p>}
      <p className="mt-2 text-sm text-muted-foreground">
        {total > 0 && <><TimerIcon /> {t('detail.min', { n: total })}</>} {recipe.difficulty ? `· ${recipe.difficulty}` : ''}
      </p>

      <div className="my-4">
        <div className="print:hidden">
          <ServingsStepperSlot servings={servings} setServings={setServings} />
        </div>
        {/* The stepper is useless on paper, but the quantities below are scaled
            to it — so print the number it settled on instead. */}
        <p className="hidden text-sm print:block">
          {t('detail.servings')}: <span className="font-semibold">{servings}</span>
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 print:hidden">
        <AddToListButton recipeId={recipe.id} servings={servings} recipeRoomId={recipe.room_id} />
        {recipe.steps.length > 0 && (
          <Button asChild variant="outline">
            {/* Carry the scaler's current value into cook mode. */}
            <Link href={`/recipes/${recipe.id}/cook?servings=${servings}`}><ChefHatIcon />{t('detail.startCooking')}</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-[40%_1fr]">
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">{t('detail.ingredients')}</h2>
          <ul className="space-y-1 text-sm">
            {scaled.map((ing, idx) => (
              <li key={idx} className="border-b py-1 print:break-inside-avoid">
                {formatQuantity(ing.quantity)} {ing.unit ? t('unit.' + ing.unit) : ''} {ing.name}
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
                <li key={s.id} className="flex gap-2 print:break-inside-avoid">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs">{s.step_number}</span>
                  <div className="flex-1 space-y-2">
                    <span>{s.text}</span>
                    {stepImg && (
                      <RecipePhoto src={stepImg} alt="" sizes="(max-width: 768px) 100vw, 720px" className="aspect-[4/3] w-full rounded-lg" />
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      </div>
    </article>
  )
}

function ServingsStepperSlot({ servings, setServings }: { servings: number; setServings: (n: number) => void }) {
  return <ServingsStepper value={servings} onChange={setServings} />
}
