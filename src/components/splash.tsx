'use client'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { useT } from '@/components/i18n-provider'
import { cn } from '@/lib/utils'
import { WELCOMED_KEY } from '@/lib/welcome'

const NAME = 'RecipeGo'
// The opening plays for this long (less where motion is turned down), and the
// animation stays at most this long, however far the page has got.
const INTRO_MS = 1500
const INTRO_REDUCED_MS = 600
const CAP_MS = 8000

const never = () => () => {}
const welcomedAlready = () => document.documentElement.hasAttribute('data-welcomed')

// The welcome animation on opening the app: the egg lands, the yolk drops in,
// the name rises, and then it waits, the yolk breathing, until the page under
// it has loaded, pictures and all. Then it fades to the page. A tap or a key
// skips it.
//
// The stylesheet plays it (globals.css, .splash), and would hide it after 4s
// by itself if this script never ran. Once React is running, this pauses that
// (.splash--held), decides when it goes, and takes it out of the page after.
// Once a session: see lib/welcome.ts.
export function Splash() {
  const t = useT()
  // The server, and the hydration render, can't know either: they draw it, and
  // the stylesheet keeps it hidden in a session that has seen it.
  const welcomed = useSyncExternalStore(never, welcomedAlready, () => false)
  const running = useSyncExternalStore(never, () => true, () => false)
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)
  const showing = !welcomed && !gone
  const splash = useRef<HTMLDivElement>(null)

  // Only now is the session counted as welcomed: a page reloaded before this
  // plays it again, rather than cutting it off.
  const leave = useCallback(() => {
    try {
      sessionStorage.setItem(WELCOMED_KEY, '1')
    } catch {
      // Storage blocked: it plays again on the next page loaded.
    }
    // Hidden already by the stylesheet's own timing (React got going late):
    // just gone, as fading it out would first bring it back.
    const el = splash.current
    if (!el || getComputedStyle(el).visibility === 'hidden') setGone(true)
    else setLeaving(true)
  }, [])

  // Leaves once the opening has played and the page has loaded, or at CAP_MS,
  // both timed from when it appeared; a tap or a key leaves at once.
  useEffect(() => {
    if (!showing) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const intro = reduced ? INTRO_REDUCED_MS : INTRO_MS
    let played = false
    let loaded = document.readyState === 'complete'
    const timers: ReturnType<typeof setTimeout>[] = []
    const leaveIfReady = () => {
      if (played && loaded) leave()
    }
    const onLoad = () => {
      loaded = true
      leaveIfReady()
    }
    const time = (appeared: number) => {
      const after = (ms: number) => Math.max(0, appeared + ms - performance.now())
      timers.push(setTimeout(() => {
        played = true
        leaveIfReady()
      }, after(intro)))
      timers.push(setTimeout(leave, after(CAP_MS)))
    }
    // No frame drawn yet (React can start before the stylesheet has come):
    // it appears with the next one.
    let frame = 0
    if (window.__recipegoSplashAt !== undefined) time(window.__recipegoSplashAt)
    else if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(() => time(performance.now()))
    else time(performance.now())
    window.addEventListener('load', onLoad)
    window.addEventListener('keydown', leave)
    return () => {
      timers.forEach(clearTimeout)
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('load', onLoad)
      window.removeEventListener('keydown', leave)
    }
  }, [showing, leave])

  // Gone when its fade-out ends, or shortly after if that's never reported.
  useEffect(() => {
    if (!leaving) return
    const fallback = setTimeout(() => setGone(true), 800)
    return () => clearTimeout(fallback)
  }, [leaving])

  if (!showing) return null
  return (
    <div
      ref={splash}
      aria-hidden
      data-testid="splash"
      className={cn('splash', running && 'splash--held', leaving && 'splash--leaving')}
      onPointerDown={leave}
      onAnimationEnd={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.animationName === 'splash-leave' || e.animationName === 'splash-out') setGone(true)
      }}
    >
      <div className="splash-inner">
        {/* The app icon's fried egg, in three parts that each move. */}
        <svg className="splash-egg" viewBox="2 4 28 22">
          <path
            className="splash-white"
            d="M16 6.4c3.7 0 6.2 1.9 7.4 4.7.7 1.6 2.6 1.7 3 3.6.5 2.3-1.3 4-3.4 4.2-.6 2.4-2.9 4.3-5.8 4.3-1.7 0-2.7-.7-4-.6-2.9.2-6.2-1.8-6.6-5.2-1.9-.5-3.1-2.2-2.6-4.2.4-1.7 2-2.1 2.9-3.4C8.4 8.8 11.4 6.4 16 6.4Z"
            fill="#F7F1E7"
          />
          <g className="splash-yolk">
            <circle cx="15.4" cy="14.6" r="3.9" fill="#E6A23C" />
            <circle className="splash-shine" cx="14.1" cy="13.3" r="1.2" fill="#F2C97A" />
          </g>
        </svg>
        <p className="splash-name font-serif">
          {[...NAME].map((letter, i) => (
            <span key={i} style={{ '--i': i } as CSSProperties}>{letter}</span>
          ))}
        </p>
        <p className="splash-tagline">{t('welcome.tagline')}</p>
      </div>
    </div>
  )
}
