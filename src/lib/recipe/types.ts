export interface ImportedRecipe {
  name: string
  description?: string
  image: string | null
  servings: number | null
  prepMinutes?: number
  cookMinutes?: number
  ingredients: string[]
  // Pre-parsed ingredients (used by the share-by-link path so we don't lose
  // data round-tripping through string parsing). Preferred over `ingredients`.
  structuredIngredients?: { name: string; quantity: number | null; unit: string | null }[]
  instructions: string[]
  sourceUrl: string
  needsManualEntry?: boolean
}
