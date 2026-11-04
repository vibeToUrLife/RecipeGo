import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WELCOMED_KEY, WELCOMED_SCRIPT } from '@/lib/welcome'

const run = () => new Function(WELCOMED_SCRIPT)()

afterEach(() => {
  sessionStorage.clear()
  document.documentElement.removeAttribute('data-welcomed')
  vi.restoreAllMocks()
})

describe('the script run before the page paints', () => {
  it('notes when the first frame is drawn, for the animation to time itself from', () => {
    let drawn: FrameRequestCallback | undefined
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { drawn = cb; return 1 })
    delete window.__recipegoSplashAt
    run()
    expect(window.__recipegoSplashAt).toBeUndefined()
    drawn!(0)
    expect(window.__recipegoSplashAt).toBeTypeOf('number')
    vi.unstubAllGlobals()
  })

  it('marks <html> for a session that has seen the welcome animation', () => {
    sessionStorage.setItem(WELCOMED_KEY, '1')
    run()
    expect(document.documentElement.hasAttribute('data-welcomed')).toBe(true)
  })

  it('leaves it be on opening the app', () => {
    run()
    expect(document.documentElement.hasAttribute('data-welcomed')).toBe(false)
  })

  it('shrugs off storage being blocked (the animation just plays)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(run).not.toThrow()
    expect(document.documentElement.hasAttribute('data-welcomed')).toBe(false)
  })
})

describe('the welcome animation’s stylesheet', () => {
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

  it('hides it by itself at the end, so it can never stay up without JavaScript', () => {
    expect(css).toMatch(/\.splash \{[^}]*animation: splash-out [^;]*forwards;/)
    expect(css).toMatch(/@keyframes splash-out \{ to \{[^}]*visibility: hidden;/)
  })

  it('never shows it in a session that has seen it', () => {
    expect(css).toMatch(/html\[data-welcomed\] \.splash \{ display: none; \}/)
  })
})
