import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SPLASH_STARTED_KEY, WELCOMED_KEY, WELCOMED_SCRIPT } from '@/lib/welcome'

const run = () => new Function(WELCOMED_SCRIPT)()

afterEach(() => {
  sessionStorage.clear()
  document.documentElement.removeAttribute('data-welcomed')
  document.documentElement.style.removeProperty('--splash-skip')
  delete window.__recipegoSplashSkip
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

  it('carries on an animation the service worker began, from where it had got', () => {
    sessionStorage.setItem(SPLASH_STARTED_KEY, String(Date.now() - 700))
    run()
    expect(window.__recipegoSplashSkip).toBeGreaterThanOrEqual(700)
    expect(window.__recipegoSplashSkip).toBeLessThan(800)
    expect(document.documentElement.style.getPropertyValue('--splash-skip')).toBe(`${window.__recipegoSplashSkip}ms`)
    // Once: a page loaded after this one starts its own.
    expect(sessionStorage.getItem(SPLASH_STARTED_KEY)).toBeNull()
  })

  it('takes no note that isn’t this opening’s, too old or not yet come', () => {
    for (const started of [Date.now() - 60_000, Date.now() + 5_000, Number.NaN]) {
      sessionStorage.setItem(SPLASH_STARTED_KEY, String(started))
      run()
      expect(window.__recipegoSplashSkip).toBeUndefined()
      expect(document.documentElement.style.getPropertyValue('--splash-skip')).toBe('')
      expect(sessionStorage.getItem(SPLASH_STARTED_KEY)).toBeNull()
    }
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

  it('starts each part of the opening as far on as the service worker had got, but not its own hiding', () => {
    for (const part of ['splash-white', 'splash-yolk', 'splash-shine', 'splash-name span', 'splash-tagline']) {
      const rule = new RegExp(`(?:^|\\n)\\.${part} \\{([^}]*)\\}`).exec(css)?.[1] ?? ''
      const delays = /animation-delay: ([^;]*);/.exec(rule)?.[1] ?? ''
      expect(delays, part).not.toBe('')
      for (const delay of delays.split(/,(?![^(]*\))/)) expect(delay, part).toMatch(/- var\(--splash-skip, 0ms\)\)$/)
    }
    expect(css).not.toMatch(/\.splash \{[^}]*--splash-skip/)
  })
})
