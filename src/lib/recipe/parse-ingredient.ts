import type { Unit } from '@/lib/types'

const UNIT_MAP: Record<string, Unit> = {
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  ml: 'ml', millilitre: 'ml', milliliter: 'ml', millilitres: 'ml', milliliters: 'ml',
  l: 'l', liter: 'l', litre: 'l', liters: 'l', litres: 'l',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  cup: 'cup', cups: 'cup',
  clove: 'clove', cloves: 'clove',
  slice: 'slice', slices: 'slice',
  pinch: 'pinch', pinches: 'pinch',
  piece: 'piece', pieces: 'piece',
}

// Matches: optional whole number, then optional fraction, then optional attached unit letters
// Groups: 1=whole, 2=frac_num, 3=frac_den, 4=attached_unit
const LEADING_NUM_RE = /^(\d+(?:\.\d+)?)(?:\/(\d+))?(?:\s+(\d+)\/(\d+))?\s*/

export function parseIngredientLine(line: string): { name: string; quantity: number | null; unit: Unit } {
  const trimmed = line.trim()

  // Try to match leading quantity
  // Pattern: optional integer/decimal, optional fraction, or mixed number
  // We'll try multiple patterns in order of specificity

  // 1. Mixed number: "1 1/2"
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)\s*/)
  // 2. Fraction only: "1/2"
  const fracMatch = trimmed.match(/^(\d+)\/(\d+)\s*/)
  // 3. Decimal or integer: "1.5" or "200"
  const numMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*/)

  let quantity: number | null = null
  let rest = trimmed

  if (mixedMatch) {
    quantity = parseInt(mixedMatch[1], 10) + parseInt(mixedMatch[2], 10) / parseInt(mixedMatch[3], 10)
    rest = trimmed.slice(mixedMatch[0].length)
  } else if (fracMatch) {
    quantity = parseInt(fracMatch[1], 10) / parseInt(fracMatch[2], 10)
    rest = trimmed.slice(fracMatch[0].length)
  } else if (numMatch) {
    // Check if there's an attached unit letter right after the number (e.g. "200g")
    const attachedUnit = trimmed.slice(numMatch[0].trimEnd().length).match(/^([a-zA-Z]+)\b/)
    if (attachedUnit) {
      quantity = parseFloat(numMatch[1])
      const unitKey = attachedUnit[1].toLowerCase()
      const mapped = UNIT_MAP[unitKey]
      if (mapped !== undefined) {
        // unit was attached directly with no space
        rest = trimmed.slice(numMatch[0].trimEnd().length + attachedUnit[0].length).trim()
        return { quantity, unit: mapped, name: rest }
      }
    }
    quantity = parseFloat(numMatch[1])
    rest = trimmed.slice(numMatch[0].length)
  } else {
    // No leading number
    return { quantity: null, unit: null, name: trimmed }
  }

  // Now try to consume a unit token from `rest`
  const unitMatch = rest.match(/^([a-zA-Z]+)\b\s*/)
  if (unitMatch) {
    const unitKey = unitMatch[1].toLowerCase()
    const mapped = UNIT_MAP[unitKey]
    if (mapped !== undefined) {
      const name = rest.slice(unitMatch[0].length).trim()
      return { quantity, unit: mapped, name }
    }
  }

  // No known unit — the rest is the name
  return { quantity, unit: null, name: rest.trim() }
}
