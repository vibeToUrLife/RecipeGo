'use client'
import { useEffect, useSyncExternalStore } from 'react'
import { canReloadToRecover, reloadToRecover } from '@/lib/recover'

const never = () => () => {}

// A failure in the root layout itself, which app/error.tsx sits inside and so
// can't catch. It takes the layout's place, so it brings its own page, and no
// stylesheet or language: it reloads like app/error.tsx does, over the welcome
// animation's terracotta, and only after two tries in a minute says so, in both
// languages.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const reloading = useSyncExternalStore(never, canReloadToRecover, () => true)

  useEffect(() => {
    console.error(error)
    if (reloading) reloadToRecover()
  }, [error, reloading])

  return (
    <html lang="zh">
      <body style={{ margin: 0, minHeight: '100vh', background: '#c65d3b', color: '#f7f1e7', fontFamily: 'system-ui, sans-serif' }}>
        {!reloading && (
          <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: '0 1.5rem', textAlign: 'center' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem' }}>出了点问题 · Something went wrong</h1>
              <p style={{ margin: '0 0 1.25rem', opacity: 0.9 }}>RecipeGo 没能加载出来，请稍后再试。<br />RecipeGo didn’t load. Please try again in a moment.</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{ font: 'inherit', padding: '0.6rem 1.2rem', border: 0, borderRadius: '999px', background: '#f7f1e7', color: '#c65d3b', cursor: 'pointer' }}
              >
                重新载入 · Reload
              </button>
              {error.digest && <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', opacity: 0.8 }}>{error.digest}</p>}
            </div>
          </main>
        )}
      </body>
    </html>
  )
}
