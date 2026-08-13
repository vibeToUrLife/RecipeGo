import type { IngredientInput } from '@/lib/types'

export function scaleIngredients(
  items: IngredientInput[],
  fromServings: number,
  toServings: number,
): IngredientInput[] {
  if (fromServings <= 0) throw new Error('fromServings must be > 0')
  const factor = toServings / fromServings
  return items.map((item) => {
    if (item.quantity === null) return { ...item }
    const scaled = Math.round(item.quantity * factor * 100) / 100
    return { ...item, quantity: scaled }
  })
}
