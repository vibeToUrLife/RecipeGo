export interface RecipeIngredients {
  id: string
  title: string
  room_id: string | null
  ingredients: string[]
}

export interface CookMatch {
  id: string
  title: string
  room_id: string | null
  total: number
  missing: string[]
}

/** Normalize an ingredient name for matching (case/whitespace-insensitive). */
export function normalizeIng(name: string): string {
  return name.trim().toLowerCase()
}

/** Distinct ingredient names across all recipes, with a display label (first-seen casing), sorted. */
export function ingredientUniverse(recipes: RecipeIngredients[]): string[] {
  const seen = new Map<string, string>() // normalized -> display
  for (const r of recipes) {
    for (const raw of r.ingredients) {
      const n = normalizeIng(raw)
      if (n && !seen.has(n)) seen.set(n, raw.trim())
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

/**
 * Split recipes into "ready" (you have every ingredient) and "almost"
 * (missing 1–3 ingredients AND you already have at least one of them, so an
 * empty pantry never makes a recipe "almost"). Recipes with no ingredients are
 * skipped. `have` is the list of ingredient names the user currently has.
 */
export function matchRecipes(
  recipes: RecipeIngredients[],
  have: string[],
): { ready: CookMatch[]; almost: CookMatch[] } {
  const haveSet = new Set(have.map(normalizeIng))
  const ready: CookMatch[] = []
  const almost: CookMatch[] = []

  for (const r of recipes) {
    const unique = [...new Set(r.ingredients.map(normalizeIng).filter((n) => n.length > 0))]
    if (unique.length === 0) continue
    const missing = unique.filter((n) => !haveSet.has(n))
    const match: CookMatch = { id: r.id, title: r.title, room_id: r.room_id, total: unique.length, missing }
    if (missing.length === 0) ready.push(match)
    // "almost" only if you're missing 1–3 AND already have at least one of them
    else if (missing.length <= 3 && missing.length < unique.length) almost.push(match)
  }

  ready.sort((a, b) => a.title.localeCompare(b.title))
  almost.sort((a, b) => a.missing.length - b.missing.length || a.title.localeCompare(b.title))
  return { ready, almost }
}
