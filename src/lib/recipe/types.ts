export interface ImportedRecipe {
  name: string
  image: string | null
  servings: number | null
  prepMinutes?: number
  cookMinutes?: number
  ingredients: string[]
  instructions: string[]
  sourceUrl: string
  needsManualEntry?: boolean
}
