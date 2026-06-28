// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { convert, canConvert, unitDimension } from '@/lib/units'

describe('unitDimension', () => {
  it('classifies mass, volume, count, and unitless', () => {
    expect(unitDimension('g')).toBe('mass')
    expect(unitDimension('tbsp')).toBe('volume')
    expect(unitDimension('clove')).toBe('count')
    expect(unitDimension(null)).toBe(null)
  })
})

describe('convert', () => {
  it('converts within mass (kg -> g)', () => {
    expect(convert(2, 'kg', 'g')).toBeCloseTo(2000, 5)
  })
  it('converts within volume (tbsp -> ml)', () => {
    expect(convert(1, 'tbsp', 'ml')).toBeCloseTo(14.7868, 2)
  })
  it('is identity for same unit', () => {
    expect(convert(5, 'cup', 'cup')).toBe(5)
  })
  it('throws across dimensions (g -> ml)', () => {
    expect(() => convert(1, 'g', 'ml')).toThrow()
  })
  it('throws for count units (clove -> g)', () => {
    expect(() => convert(1, 'clove', 'g')).toThrow()
  })
})

describe('canConvert', () => {
  it('true within a dimension, false across or for count', () => {
    expect(canConvert('g', 'kg')).toBe(true)
    expect(canConvert('ml', 'cup')).toBe(true)
    expect(canConvert('g', 'ml')).toBe(false)
    expect(canConvert('clove', 'clove')).toBe(false)
    expect(canConvert(null, null)).toBe(false)
  })
})
