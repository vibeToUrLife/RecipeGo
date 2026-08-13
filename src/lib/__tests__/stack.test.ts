// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { findStackTarget, stackedTotal, type StackTarget } from '@/lib/stack'

const rows: StackTarget[] = [
  { name: '鸡腿', unit: 'piece', totalQuantity: 3 },
  { name: 'Olive Oil', unit: 'tbsp', totalQuantity: 2 },
  { name: 'Salt', unit: null, totalQuantity: null },
]

describe('findStackTarget', () => {
  it('stacks a re-added item onto the same name + same unit', () => {
    const i = findStackTarget(rows, { name: '鸡腿', unit: 'piece', quantity: 2 })
    expect(i).toBe(0)
    expect(stackedTotal(rows[i], { name: '鸡腿', unit: 'piece', quantity: 2 })).toBe(5)
  })

  it('matches names case- and whitespace-insensitively', () => {
    const i = findStackTarget(rows, { name: '  olive   oil ', unit: 'tbsp', quantity: 1 })
    expect(i).toBe(1)
  })

  it('stacks convertible units, summing into the existing unit', () => {
    const i = findStackTarget(rows, { name: 'Olive Oil', unit: 'ml', quantity: 30 })
    expect(i).toBe(1)
    // 2 tbsp + 30ml -> 2 + 30/14.7868 ≈ 4.03 tbsp
    expect(stackedTotal(rows[i], { name: 'Olive Oil', unit: 'ml', quantity: 30 })).toBeCloseTo(4.03, 1)
  })

  it('does not stack count units onto a different count unit', () => {
    const i = findStackTarget(rows, { name: '鸡腿', unit: 'slice', quantity: 2 })
    expect(i).toBe(-1)
  })

  it('does not stack inconvertible dimensions (mass vs volume)', () => {
    const i = findStackTarget(
      [{ name: 'flour', unit: 'g', totalQuantity: 100 }],
      { name: 'flour', unit: 'cup', quantity: 1 },
    )
    expect(i).toBe(-1)
  })

  it('does not stack when the new item has no quantity but the row uses a different unit', () => {
    const i = findStackTarget(rows, { name: 'Olive Oil', unit: null, quantity: null })
    expect(i).toBe(-1)
  })

  it('returns -1 when nothing matches', () => {
    expect(findStackTarget(rows, { name: 'Milk', unit: 'l', quantity: 1 })).toBe(-1)
  })
})

describe('stackedTotal', () => {
  it('keeps the existing total when the new quantity is unspecified', () => {
    expect(stackedTotal({ name: '鸡腿', unit: 'piece', totalQuantity: 3 }, { name: '鸡腿', unit: 'piece', quantity: null })).toBe(3)
  })

  it('keeps a null existing total (unspecified stays unspecified)', () => {
    expect(stackedTotal(rows[2], { name: 'Salt', unit: null, quantity: null })).toBe(null)
  })

  it('rounds summed quantities to 2 decimals', () => {
    expect(stackedTotal({ name: 'x', unit: 'g', totalQuantity: 0.1 }, { name: 'x', unit: 'g', quantity: 0.2 })).toBe(0.3)
  })
})
