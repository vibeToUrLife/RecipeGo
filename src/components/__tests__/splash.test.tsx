import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/i18n-provider', () => ({ useT: () => (k: string) => k }))

import { Splash } from '@/components/splash'
import { WELCOMED_KEY } from '@/lib/welcome'

const splash = () => screen.queryByTestId('splash')
// jsdom has no AnimationEvent, so React listens for the prefixed
// webkitAnimationEnd there (a browser's is animationend), and the event's
// animationName is set by hand.
const animationEnd = (el: Element, animationName: string) =>
  fireEvent(el, Object.assign(new Event('webkitAnimationEnd', { bubbles: true }), { animationName }))
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

let readyState: DocumentReadyState
beforeEach(() => {
  vi.useFakeTimers()
  sessionStorage.clear()
  document.documentElement.removeAttribute('data-welcomed')
  // As the script first in the page notes it, on the first frame drawn.
  window.__recipegoSplashAt = performance.now()
  delete window.__recipegoSplashSkip
  readyState = 'complete'
  Object.defineProperty(document, 'readyState', { get: () => readyState, configurable: true })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete (document as unknown as Record<string, unknown>).readyState
})

describe('Splash', () => {
  it('plays on opening the app, with the name and the tagline', () => {
    render(<Splash />)
    expect(splash()).toHaveTextContent('RecipeGo')
    expect(splash()).toHaveTextContent('welcome.tagline')
    expect(splash()).toHaveAttribute('aria-hidden', 'true')
  })

  it('takes over the timing from the stylesheet once React runs', () => {
    render(<Splash />)
    expect(splash()).toHaveClass('splash--held')
  })

  it('plays the opening through, then leaves, when the page has loaded already', () => {
    render(<Splash />)
    wait(1499)
    expect(splash()).not.toHaveClass('splash--leaving')
    wait(1)
    expect(splash()).toHaveClass('splash--leaving')
  })

  it('waits on past the opening while the page is still loading, and leaves once it has', () => {
    readyState = 'loading'
    render(<Splash />)
    wait(3000)
    expect(splash()).not.toHaveClass('splash--leaving')
    act(() => {
      readyState = 'complete'
      window.dispatchEvent(new Event('load'))
    })
    expect(splash()).toHaveClass('splash--leaving')
  })

  it('stops waiting after 8 seconds, however far the page has got', () => {
    readyState = 'loading'
    render(<Splash />)
    wait(7999)
    expect(splash()).not.toHaveClass('splash--leaving')
    wait(1)
    expect(splash()).toHaveClass('splash--leaving')
  })

  it('times itself from when it appeared, not from when React got going', () => {
    window.__recipegoSplashAt = performance.now() - 1000
    render(<Splash />)
    wait(499)
    expect(splash()).not.toHaveClass('splash--leaving')
    wait(1)
    expect(splash()).toHaveClass('splash--leaving')
  })

  it('begun by the service worker, it plays only the rest of the opening', () => {
    window.__recipegoSplashSkip = 1000
    render(<Splash />)
    wait(499)
    expect(splash()).not.toHaveClass('splash--leaving')
    wait(1)
    expect(splash()).toHaveClass('splash--leaving')
  })

  it('and still gives the page its full 8 seconds, from when the page appeared', () => {
    window.__recipegoSplashSkip = 3000
    readyState = 'loading'
    render(<Splash />)
    wait(7999)
    expect(splash()).not.toHaveClass('splash--leaving')
    wait(1)
    expect(splash()).toHaveClass('splash--leaving')
  })

  it('starts timing with the first frame, if none was drawn before React got going', () => {
    delete window.__recipegoSplashAt
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 700))
    render(<Splash />)
    wait(700 + 1499)
    expect(splash()).not.toHaveClass('splash--leaving')
    wait(1)
    expect(splash()).toHaveClass('splash--leaving')
    vi.unstubAllGlobals()
  })

  it('counts the session as welcomed only once it leaves, so a reload before that plays it again', () => {
    render(<Splash />)
    expect(sessionStorage.getItem(WELCOMED_KEY)).toBeNull()
    wait(1500)
    expect(sessionStorage.getItem(WELCOMED_KEY)).toBe('1')
  })

  it('goes once its fade-out has finished, and not before', () => {
    render(<Splash />)
    wait(1500)
    animationEnd(splash()!.querySelector('.splash-name span')!, 'splash-rise')
    expect(splash()).toBeInTheDocument()
    animationEnd(splash()!, 'splash-leave')
    expect(splash()).toBeNull()
  })

  it('takes itself out anyway if its fade-out is never reported', () => {
    render(<Splash />)
    wait(1500)
    wait(799)
    expect(splash()).toBeInTheDocument()
    wait(1)
    expect(splash()).toBeNull()
  })

  it('is skipped by a tap, or by a key', () => {
    const { unmount } = render(<Splash />)
    fireEvent.pointerDown(splash()!)
    expect(splash()).toHaveClass('splash--leaving')
    expect(sessionStorage.getItem(WELCOMED_KEY)).toBe('1')
    unmount()

    render(<Splash />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(splash()).toHaveClass('splash--leaving')
  })

  it('just goes, without fading back in, if the stylesheet already hid it before React ran', () => {
    render(<Splash />)
    const real = window.getComputedStyle
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) =>
      el === splash() ? ({ visibility: 'hidden' } as CSSStyleDeclaration) : real(el))
    wait(1500)
    expect(splash()).toBeNull()
  })

  it('isn’t shown again in a session that has seen it', () => {
    document.documentElement.setAttribute('data-welcomed', '')
    render(<Splash />)
    expect(splash()).toBeNull()
  })
})
