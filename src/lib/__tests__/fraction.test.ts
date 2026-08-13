import { describe, it, expect } from 'vitest'
import { formatQuantity } from '@/lib/fraction'

describe('formatQuantity', () => {
  it('returns an empty string for a missing quantity', () => {
    expect(formatQuantity(null)).toBe('')
    expect(formatQuantity(undefined)).toBe('')
    expect(formatQuantity(Number.NaN)).toBe('')
  })

  it('leaves whole numbers alone', () => {
    expect(formatQuantity(0)).toBe('0')
    expect(formatQuantity(1)).toBe('1')
    expect(formatQuantity(12)).toBe('12')
  })

  it('renders the common cooking fractions', () => {
    expect(formatQuantity(0.5)).toBe('½')
    expect(formatQuantity(0.25)).toBe('¼')
    expect(formatQuantity(0.75)).toBe('¾')
    expect(formatQuantity(0.125)).toBe('⅛')
    expect(formatQuantity(0.875)).toBe('⅞')
  })

  it('handles the 2dp-rounded values scaling actually produces', () => {
    // scaleIngredients rounds to 2dp, so a third arrives as 0.33, not 0.3333…
    expect(formatQuantity(0.33)).toBe('⅓')
    expect(formatQuantity(0.67)).toBe('⅔')
    expect(formatQuantity(0.13)).toBe('⅛')
    expect(formatQuantity(0.38)).toBe('⅜')
    expect(formatQuantity(0.63)).toBe('⅝')
  })

  it('joins a whole part to its fraction without a space', () => {
    expect(formatQuantity(1.5)).toBe('1½')
    expect(formatQuantity(2.25)).toBe('2¼')
    expect(formatQuantity(1.33)).toBe('1⅓')
    expect(formatQuantity(10.75)).toBe('10¾')
  })

  it('snaps to a whole number when rounding left a sliver behind', () => {
    expect(formatQuantity(1.999)).toBe('2')
    expect(formatQuantity(3.002)).toBe('3')
  })

  it('falls back to a trimmed decimal rather than misreporting the amount', () => {
    expect(formatQuantity(0.35)).toBe('0.35')
    expect(formatQuantity(1.1)).toBe('1.1')
    expect(formatQuantity(2.7)).toBe('2.7')
  })

  it('never pulls a value onto a neighbouring glyph', () => {
    // 0.35 sits between ⅓ (0.333) and ⅜ (0.375) — both are outside tolerance.
    expect(formatQuantity(0.35)).not.toContain('⅓')
    expect(formatQuantity(0.35)).not.toContain('⅜')
  })

  it('shows negatives as plain decimals instead of inventing a fraction', () => {
    expect(formatQuantity(-0.5)).toBe('-0.5')
  })
})
