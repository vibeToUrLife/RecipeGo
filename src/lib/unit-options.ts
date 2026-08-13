import type { Unit } from '@/lib/types'

// Shared unit picker options, grouped for the dropdowns in the recipe form and
// the shopping list. Keep in sync with the Unit type in types.ts.
export const UNIT_GROUPS: { label: string; units: NonNullable<Unit>[] }[] = [
  { label: 'Mass', units: ['g', 'kg', 'oz', 'lb'] },
  { label: 'Volume', units: ['ml', 'l', 'tsp', 'tbsp', 'cup'] },
  { label: 'Count', units: ['piece', 'clove', 'pinch', 'slice'] },
  { label: 'Other', units: ['to taste'] },
]

// Flat allow-list for server-side validation.
export const VALID_UNITS: NonNullable<Unit>[] = UNIT_GROUPS.flatMap((g) => g.units)
