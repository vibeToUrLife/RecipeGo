// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { normalizeEmail, isValidEmail } from '@/lib/email'
describe('email', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeEmail('  Mom@Email.COM ')).toBe('mom@email.com')
  })
  it('validates basic shape', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('nope')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})
