import type { IngredientInput, ShoppingItem, Unit, Aisle } from '@/lib/types'
import { canConvert, convert } from '@/lib/units'
import { categorizeIngredient, AISLE_ORDER } from '@/lib/aisles'

type SourceItem = IngredientInput & { recipeId: string }

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')

interface Bucket {
  name: string
  unit: Unit
  total: number | null
  category?: Aisle
  recipeIds: Set<string>
  count: number
}

export function mergeIngredients(items: SourceItem[]): ShoppingItem[] {
  const buckets: Bucket[] = []

  for (const item of items) {
    const key = norm(item.name)
    // find an existing bucket with same name and a mergeable unit
    let bucket = buckets.find((b) => {
      if (norm(b.name) !== key) return false
      if (b.unit === item.unit) return true
      if (item.quantity === null || b.total === null) return false
      return canConvert(b.unit, item.unit)
    })

    if (!bucket) {
      bucket = {
        name: item.name,
        unit: item.unit,
        total: item.quantity,
        category: item.category,
        recipeIds: new Set([item.recipeId]),
        count: 1,
      }
      buckets.push(bucket)
      continue
    }

    bucket.count += 1
    bucket.recipeIds.add(item.recipeId)
    if (!bucket.category && item.category) bucket.category = item.category

    if (item.quantity === null || bucket.total === null) {
      // can't sum; keep total as-is (null stays null)
      continue
    }
    const add = bucket.unit === item.unit
      ? item.quantity
      : convert(item.quantity, item.unit, bucket.unit)
    bucket.total = Math.round((bucket.total + add) * 100) / 100
  }

  const out: ShoppingItem[] = buckets.map((b) => ({
    name: b.name,
    totalQuantity: b.total,
    unit: b.unit,
    category: b.category ?? categorizeIngredient(b.name),
    sourceRecipeIds: [...b.recipeIds],
    mergedCount: b.count,
  }))

  out.sort((a, b) => {
    const ai = AISLE_ORDER.indexOf(a.category)
    const bi = AISLE_ORDER.indexOf(b.category)
    if (ai !== bi) return ai - bi
    return a.name.localeCompare(b.name)
  })
  return out
}
