'use client'
import { useState, useRef } from 'react'
import { saveRecipe } from '@/app/recipes/actions'
import type { RecipeWithChildren } from '@/lib/db-types'
import type { ImportedRecipe } from '@/lib/recipe/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ImageUpload } from '@/components/image-upload'
import { parseIngredientLine } from '@/lib/recipe/parse-ingredient'

type Row = { id: string; name: string; qty: string; unit: string }
type StepRow = { id: string; text: string }

export function RecipeForm({ recipe, imported }: { recipe?: RecipeWithChildren; imported?: ImportedRecipe | null }) {
  const [ings, setIngs] = useState<Row[]>(
    imported && imported.ingredients.length
      ? imported.ingredients.map((line, i) => { const p = parseIngredientLine(line); return { id: `ing-${i}`, name: p.name, qty: p.quantity?.toString() ?? '', unit: p.unit ?? '' } })
      : (recipe?.ingredients.map((ing, i) => ({ id: `ing-${i}`, name: ing.name, qty: ing.quantity?.toString() ?? '', unit: ing.unit ?? '' })) ?? [{ id: 'ing-0', name: '', qty: '', unit: '' }])
  )
  const [steps, setSteps] = useState<StepRow[]>(
    imported && imported.instructions.length
      ? imported.instructions.map((text, i) => ({ id: `step-${i}`, text }))
      : (recipe?.steps.map((s, i) => ({ id: `step-${i}`, text: s.text })) ?? [{ id: 'step-0', text: '' }])
  )
  const nextIngId = useRef(
    imported && imported.ingredients.length ? imported.ingredients.length : (recipe?.ingredients.length ?? 1)
  )
  const nextStepId = useRef(
    imported && imported.instructions.length ? imported.instructions.length : (recipe?.steps.length ?? 1)
  )

  return (
    <form action={saveRecipe} className="space-y-5">
      {recipe && <input type="hidden" name="id" value={recipe.id} />}
      <input type="hidden" name="source_url" value={imported?.sourceUrl ?? recipe?.source_url ?? ''} />
      <ImageUpload defaultPath={recipe?.image_path} />

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required defaultValue={imported?.name ?? recipe?.title} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={recipe?.description ?? ''} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2"><Label htmlFor="servings">Servings</Label><Input id="servings" name="servings" type="number" min={1} defaultValue={imported?.servings ?? recipe?.servings ?? 2} /></div>
        <div className="space-y-2"><Label htmlFor="prep_minutes">Prep (min)</Label><Input id="prep_minutes" name="prep_minutes" type="number" min={0} defaultValue={imported?.prepMinutes ?? recipe?.prep_minutes ?? ''} /></div>
        <div className="space-y-2"><Label htmlFor="cook_minutes">Cook (min)</Label><Input id="cook_minutes" name="cook_minutes" type="number" min={0} defaultValue={imported?.cookMinutes ?? recipe?.cook_minutes ?? ''} /></div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="difficulty">Difficulty</Label>
        <select id="difficulty" name="difficulty" defaultValue={recipe?.difficulty ?? ''}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">—</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Ingredients</legend>
        {ings.map((row) => (
          <div key={row.id} className="flex gap-2">
            <Input name="ing_qty" placeholder="Qty" defaultValue={row.qty} className="w-20" />
            <Input name="ing_unit" placeholder="unit" defaultValue={row.unit} className="w-24" />
            <Input name="ing_name" placeholder="Ingredient" defaultValue={row.name} className="flex-1" />
            <Button type="button" variant="ghost" size="icon" onClick={() => setIngs(ings.filter((r) => r.id !== row.id))}>✕</Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setIngs([...ings, { id: `ing-${nextIngId.current++}`, name: '', qty: '', unit: '' }])}>＋ Add ingredient</Button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Method</legend>
        {steps.map((row, i) => (
          <div key={row.id} className="flex gap-2">
            <span className="pt-2 text-sm text-muted-foreground">{i + 1}.</span>
            <Textarea name="step_text" placeholder="Describe this step" defaultValue={row.text} className="flex-1" />
            <Button type="button" variant="ghost" size="icon" onClick={() => setSteps(steps.filter((r) => r.id !== row.id))}>✕</Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setSteps([...steps, { id: `step-${nextStepId.current++}`, text: '' }])}>＋ Add step</Button>
      </fieldset>

      <Button type="submit" className="w-full">{recipe ? 'Save changes' : 'Create recipe'}</Button>
    </form>
  )
}
