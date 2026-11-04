'use client'
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { useT } from '@/components/i18n-provider'
import { cn } from '@/lib/utils'
import { WELCOMED_KEY } from '@/lib/welcome'

const NAME = 'RecipeGo'
const never = () => () => {}
const welcomedAlready = () => document.documentElement.hasAttribute('data-welcomed')

// The welcome animation on opening the app: the egg lands, the yolk drops in,
// the name rises, then it all fades to the page, which has been loading
// underneath. About 1.8 seconds; a tap or a key skips it.
//
// It plays, and hides itself at the end, by CSS alone (globals.css, .splash), so
// it can never stay up over the page if this script doesn't run. This only
// lets it be skipped, and takes it out of the page once it's done. Once a
// session: see lib/welcome.ts.
export function Splash() {
  const t = useT()
  // The server, and the hydration render, can't know: they draw it, and the
  // stylesheet keeps it hidden in a session that has seen it.
  const welcomed = useSyncExternalStore(never, welcomedAlready, () => false)
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)
  const showing = !welcomed && !gone

  useEffect(() => {
    if (!showing) return
    try {
      sessionStorage.setItem(WELCOMED_KEY, '1')
    } catch {
      // Storage blocked: it plays again on the next page loaded.
    }
    const skip = () => setLeaving(true)
    window.addEventListener('keydown', skip)
    // If its fade-out never reports finishing (a tab in the background, say).
    const fallback = setTimeout(() => setGone(true), 4000)
    return () => {
      window.removeEventListener('keydown', skip)
      clearTimeout(fallback)
    }
  }, [showing])

  if (!showing) return null
  return (
    <div
      aria-hidden
      data-testid="splash"
      className={cn('splash', leaving && 'splash--leaving')}
      onPointerDown={() => setLeaving(true)}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && e.animationName === 'splash-out') setGone(true)
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
