'use client'
import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { X, ChevronLeft, ChevronRight, ListChecks, Lightbulb, LightbulbOff, CircleCheck } from 'lucide-react'
import type { RecipeWithChildren } from '@/lib/db-types'
import type { IngredientInput } from '@/lib/types'
import { scaleIngredients } from '@/lib/scaling'
import { formatQuantity } from '@/lib/fraction'
import { publicImageUrl } from '@/lib/image-url'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useT } from '@/components/i18n-provider'

// Hands-on cooking screen: one step at a time in large type, a tickable
// ingredient list, and the screen held awake. Everything is local state — this
// is a view over the recipe, nothing here writes to the database.
export function CookMode({ recipe, servings }: { recipe: RecipeWithChildren; servings: number }) {
  const t = useT()
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [panelOpen, setPanelOpen] = useState(false)

  const steps = recipe.steps
  const last = steps.length - 1
  const base: IngredientInput[] = recipe.ingredients.map((i) => ({
    name: i.name, quantity: i.quantity, unit: i.unit, category: i.category,
  }))
  const scaled = scaleIngredients(base, recipe.servings, servings)

  const exit = useCallback(() => router.push(`/recipes/${recipe.id}`), [router, recipe.id])
  const next = useCallback(() => setIndex((i) => Math.min(i + 1, last)), [last])
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])

  const awake = useScreenWakeLock()

  // Sticky hands, small screen: arrow keys move between steps, Escape backs out
  // (closing the ingredient sheet first if it's covering the step).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      if (e.key === 'ArrowRight') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
      else if (e.key === 'Escape') { if (panelOpen) setPanelOpen(false); else exit() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, exit, panelOpen])

  function toggleIngredient(key: string) {
    setChecked((current) => {
      const copy = new Set(current)
      if (copy.has(key)) copy.delete(key)
      else copy.add(key)
      return copy
    })
  }

  // The checkbox is the focusable control; the text beside it is a second, much
  // bigger tap target for hands that are busy. They're wired together by id so
  // screen readers still announce which ingredient the box belongs to.
  const ingredientList = (
    <ul className="space-y-1">
      {scaled.map((ing, i) => {
        const key = String(i)
        const labelId = `cook-ing-${i}`
        const isOn = checked.has(key)
        return (
          <li key={key} className="flex items-center gap-3 rounded-md px-2 py-2.5 text-base hover:bg-muted/60">
            <Checkbox checked={isOn} onCheckedChange={() => toggleIngredient(key)} aria-labelledby={labelId} />
            <span
              id={labelId}
              onClick={() => toggleIngredient(key)}
              className={`flex-1 cursor-pointer select-none ${isOn ? 'text-muted-foreground line-through' : ''}`}
            >
              <span className="font-medium">{formatQuantity(ing.quantity)}{ing.unit ? ` ${t('unit.' + ing.unit)}` : ''}</span>
              {' '}{ing.name}
            </span>
          </li>
        )
      })}
    </ul>
  )

  if (steps.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg">{t('cookMode.noSteps')}</p>
        <Button onClick={exit}>{t('cookMode.exit')}</Button>
      </div>
    )
  }

  const step = steps[index]
  const stepImg = publicImageUrl(step.image_path)
  const progress = Math.round(((index + 1) / steps.length) * 100)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={exit} aria-label={t('cookMode.exit')}>
            <X className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-serif text-lg text-primary">{recipe.title}</h1>
            <p className="text-xs text-muted-foreground">
              {t('cookMode.stepOf', { n: index + 1, total: steps.length })} · {t('card.servingsCount', { n: servings })}
            </p>
          </div>
          <span
            title={awake ? t('cookMode.screenOn') : t('cookMode.screenOff')}
            className="hidden text-muted-foreground sm:block"
          >
            {awake ? <Lightbulb className="size-4" /> : <LightbulbOff className="size-4" />}
            <span className="sr-only">{awake ? t('cookMode.screenOn') : t('cookMode.screenOff')}</span>
          </span>
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setPanelOpen(true)}>
            <ListChecks className="size-4" /> {t('cookMode.ingredients')}
          </Button>
        </div>
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={index + 1}
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-label={t('cookMode.progressAria')}
          />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[18rem_1fr]">
        {/* Desktop: the list stays alongside the step. */}
        <aside className="hidden lg:block">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">{t('detail.ingredients')}</h2>
          {ingredientList}
        </aside>

        <main className="flex flex-col">
          <div className="flex-1">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-lg text-primary-foreground">
              {index + 1}
            </span>
            <p className="mt-4 max-w-prose text-xl leading-relaxed sm:text-2xl">{step.text}</p>
            {stepImg && (
              <Image
                src={stepImg}
                alt=""
                width={960}
                height={600}
                className="mt-5 w-full max-w-2xl rounded-xl object-cover"
              />
            )}
          </div>
        </main>
      </div>

      <footer className="sticky bottom-0 border-t bg-card/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          {/* Deliberately oversized: these get tapped with a knuckle. */}
          <Button variant="outline" size="lg" className="h-12 px-5 text-base" onClick={prev} disabled={index === 0}>
            <ChevronLeft className="size-5" /> {t('cookMode.prev')}
          </Button>
          {index === last ? (
            <Button size="lg" className="h-12 px-6 text-base" onClick={exit}>
              <CircleCheck className="size-5" /> {t('cookMode.finish')}
            </Button>
          ) : (
            <Button size="lg" className="h-12 px-6 text-base" onClick={next}>
              {t('cookMode.next')} <ChevronRight className="size-5" />
            </Button>
          )}
        </div>
      </footer>

      {/* Mobile: the list slides over the step instead of pushing it off-screen. */}
      {panelOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-black/40"
            aria-label={t('common.cancel')}
            onClick={() => setPanelOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-lg text-primary">{t('detail.ingredients')}</h2>
              <Button variant="ghost" size="icon" onClick={() => setPanelOpen(false)} aria-label={t('common.cancel')}>
                <X className="size-5" />
              </Button>
            </div>
            {ingredientList}
          </div>
        </div>
      )}
    </div>
  )
}

// Holds the screen awake while cooking. Browsers drop the lock whenever the tab
// is hidden (locking the phone, switching apps), so it is re-acquired on the way
// back instead of silently staying off. Unsupported browsers just report false.
function useScreenWakeLock(): boolean {
  const [awake, setAwake] = useState(false)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    async function acquire() {
      if (cancelled || document.visibilityState !== 'visible') return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) { void lock.release(); return }
        sentinel = lock
        setAwake(true)
        lock.addEventListener('release', () => {
          // Dropped by the browser (tab hidden, battery saver). Clear the
          // handle so coming back to the tab re-acquires instead of assuming
          // the lock is still held.
          sentinel = null
          setAwake(false)
        })
      } catch {
        setAwake(false) // denied (e.g. battery saver) — cooking still works
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible' && sentinel === null) void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release()
      sentinel = null
    }
  }, [])

  return awake
}
