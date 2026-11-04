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

beforeEach(() => {
  sessionStorage.clear()
  document.documentElement.removeAttribute('data-welcomed')
})
afterEach(() => vi.useRealTimers())

describe('Splash', () => {
  it('plays on opening the app, with the name and the tagline', () => {
    render(<Splash />)
    expect(splash()).toBeInTheDocument()
    expect(splash()).toHaveTextContent('RecipeGo')
    expect(splash()).toHaveTextContent('welcome.tagline')
    expect(splash()).toHaveAttribute('aria-hidden', 'true')
  })

  it('marks the session as welcomed, so later pages skip it', () => {
    render(<Splash />)
    expect(sessionStorage.getItem(WELCOMED_KEY)).toBe('1')
  })

  it('goes once its fade-out has finished, and not before', () => {
    render(<Splash />)
    animationEnd(splash()!.querySelector('.splash-name span')!, 'splash-rise')
    animationEnd(splash()!, 'splash-rise')
    expect(splash()).toBeInTheDocument()

    animationEnd(splash()!, 'splash-out')
    expect(splash()).toBeNull()
  })

  it('is skipped by a tap, or by a key', () => {
    const { unmount } = render(<Splash />)
    fireEvent.pointerDown(splash()!)
    expect(splash()).toHaveClass('splash--leaving')
    unmount()

    render(<Splash />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(splash()).toHaveClass('splash--leaving')
  })

  it('isn’t shown again in a session that has seen it', () => {
    document.documentElement.setAttribute('data-welcomed', '')
    render(<Splash />)
    expect(splash()).toBeNull()
  })

  it('takes itself out anyway if its fade-out never reports finishing', () => {
    vi.useFakeTimers()
    render(<Splash />)
    act(() => { vi.advanceTimersByTime(3999) })
    expect(splash()).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(1) })
    expect(splash()).toBeNull()
  })
})
