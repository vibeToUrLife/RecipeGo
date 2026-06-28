import type { Unit } from '@/lib/types'

type Dimension = 'mass' | 'volume' | 'count'

// base units: mass -> grams, volume -> millilitres
const MASS: Partial<Record<NonNullable<Unit>, number>> = {
  g: 1, kg: 1000, oz: 28.3495, lb: 453.592,
}
const VOLUME: Partial<Record<NonNullable<Unit>, number>> = {
  ml: 1, l: 1000, tsp: 4.92892, tbsp: 14.7868, cup: 236.588,
}
const COUNT = new Set<NonNullable<Unit>>(['piece', 'clove', 'pinch', 'slice'])

export function unitDimension(unit: Unit): Dimension | null {
  if (unit === null) return null
  if (unit in MASS) return 'mass'
  if (unit in VOLUME) return 'volume'
  if (COUNT.has(unit)) return 'count'
  return null
}

export function canConvert(from: Unit, to: Unit): boolean {
  const a = unitDimension(from)
  const b = unitDimension(to)
  if (a === null || b === null) return false
  if (a === 'count' || b === 'count') return false
  return a === b
}

export function convert(qty: number, from: Unit, to: Unit): number {
  if (from === to) return qty
  const dim = unitDimension(from)
  if (dim === null || unitDimension(to) !== dim || dim === 'count') {
    throw new Error(`Cannot convert ${from} to ${to}`)
  }
  const table = dim === 'mass' ? MASS : VOLUME
  const fromFactor = table[from as NonNullable<Unit>]
  const toFactor = table[to as NonNullable<Unit>]
  if (fromFactor === undefined || toFactor === undefined) {
    throw new Error(`Cannot convert ${from} to ${to}`)
  }
  return (qty * fromFactor) / toFactor
}
