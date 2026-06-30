'use client'
import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Plus, X, Check, ChevronRight } from 'lucide-react'
import { setPantryItemAction, setPantryAmountAction } from '@/app/cook/actions'
import { matchRecipes, normalizeIng, type RecipeIngredients } from '@/lib/cook/match'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useT } from '@/components/i18n-provider'

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

function CountBadge({ children, tone = 'primary' }: { children: React.ReactNode; tone?: 'primary' | 'secondary' | 'accent' }) {
  const tones = {
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary/15 text-secondary',
    accent: 'bg-accent/25 text-accent-foreground',
  }
  return (
    <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function CookPlanner({
  recipes,
  universe,
  initialHave,
}: {
  recipes: RecipeIngredients[]
  universe: string[]
  initialHave: { name: string; amount: string | null }[]
}) {
  const t = useT()
  // normalized name -> free-text amount ('' = no amount noted)
  const [have, setHave] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>()
    for (const it of initialHave) m.set(normalizeIng(it.name), it.amount ?? '')
    return m
  })
  const [draft, setDraft] = useState('')
  const [draftAmount, setDraftAmount] = useState('')
  const [, startTransition] = useTransition()

  // normalized name -> nice display label (recipe casing if known, else title-cased)
  const displayOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const label of universe) m.set(normalizeIng(label), label)
    return (n: string) => m.get(n) ?? titleCase(n)
  }, [universe])

  // Matching depends only on WHICH ingredients you have, not their amounts, so
  // editing an amount doesn't re-run the match.
  const haveKeysStr = useMemo(() => [...have.keys()].sort().join('\n'), [have])
  const { ready, almost } = useMemo(
    () => matchRecipes(recipes, haveKeysStr ? haveKeysStr.split('\n') : []),
    [recipes, haveKeysStr],
  )

  function persistPresence(key: string, present: boolean, revert: () => void) {
    startTransition(async () => {
      try {
        await setPantryItemAction(key, present)
      } catch {
        toast.error(t('cook.saveFailed'))
        revert()
      }
    })
  }

  function persistAmount(key: string, amount: string, revert?: () => void) {
    startTransition(async () => {
      try {
        await setPantryAmountAction(key, amount)
      } catch {
        toast.error(t('cook.saveFailed'))
        revert?.()
      }
    })
  }

  function add(name: string, amount = '') {
    const key = normalizeIng(name)
    if (!key) return
    if (have.has(key)) {
      if (amount) {
        setHave((prev) => new Map(prev).set(key, amount))
        persistAmount(key, amount)
      }
      return
    }
    setHave((prev) => new Map(prev).set(key, amount))
    const revert = () => setHave((prev) => { const m = new Map(prev); m.delete(key); return m })
    if (amount) persistAmount(key, amount, revert)
    else persistPresence(key, true, revert)
  }

  function remove(key: string) {
    if (!have.has(key)) return
    const prevAmount = have.get(key) ?? ''
    setHave((prev) => { const m = new Map(prev); m.delete(key); return m })
    persistPresence(key, false, () => setHave((prev) => new Map(prev).set(key, prevAmount)))
  }

  // controlled amount field: update locally on type, save on blur/Enter
  function editAmount(key: string, amount: string) {
    setHave((prev) => new Map(prev).set(key, amount))
  }
  function commitAmount(key: string) {
    persistAmount(key, have.get(key) ?? '')
  }

  function onAdd() {
    const v = draft.trim()
    if (!v) return
    add(v, draftAmount.trim())
    setDraft('')
    setDraftAmount('')
  }

  const haveList = [...have.keys()].sort((a, b) => displayOf(a).localeCompare(displayOf(b)))
  const suggestions = universe.filter((label) => !have.has(normalizeIng(label)))

  return (
    <div className="space-y-6">
      {/* Your ingredients — type to add (always available) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg text-primary">
            <span aria-hidden>🧺</span> {t('cook.myIngredients')} <CountBadge>{have.size}</CountBadge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onAdd()
                }
              }}
              placeholder={t('cook.addPlaceholder')}
              className="min-w-[10rem] flex-1"
            />
            <Input
              value={draftAmount}
              onChange={(e) => setDraftAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onAdd()
                }
              }}
              placeholder={t('cook.amountPlaceholder')}
              aria-label={t('cook.amountPlaceholder')}
              className="w-32"
            />
            <Button type="button" onClick={onAdd} className="shrink-0">
              <Plus className="size-4" /> {t('common.add')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('cook.amountNote')}</p>
          {haveList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('cook.haveHint')}
            </p>
          ) : (
            <div className="space-y-1.5">
              {haveList.map((key) => (
                <div key={key} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5">
                  <span className="flex-1 truncate text-sm font-medium">{displayOf(key)}</span>
                  <Input
                    value={have.get(key) ?? ''}
                    onChange={(e) => editAmount(key, e.target.value)}
                    onBlur={() => commitAmount(key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.currentTarget.blur()
                      }
                    }}
                    placeholder={t('cook.amountPlaceholder')}
                    aria-label={t('cook.amountAria', { name: displayOf(key) })}
                    className="h-8 w-28 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => remove(key)}
                    aria-label={t('cook.removeAria', { name: displayOf(key) })}
                    className="shrink-0 text-muted-foreground transition hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick add — exact ingredient names from your recipes (ensures matches) */}
      {suggestions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('cook.quickAdd')}
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => add(label)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 bg-background px-3 py-1 text-sm text-foreground transition hover:border-primary hover:bg-accent/15"
              >
                <Plus className="size-3.5 text-primary" /> {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Matches */}
      {recipes.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {t('cook.noRecipes')}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Ready to cook */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-secondary/15 text-secondary">
                <Check className="size-4" />
              </span>
              <h2 className="font-serif text-lg text-primary">{t('cook.ready')}</h2>
              <CountBadge tone="secondary">{ready.length}</CountBadge>
            </div>
            {ready.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                {t('cook.readyEmpty')}
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {ready.map((r) => (
                  <Link
                    key={r.id}
                    href={`/recipes/${r.id}`}
                    className="group flex items-center justify-between gap-2 rounded-xl border border-secondary/30 bg-secondary/5 px-4 py-3 transition hover:border-secondary/60 hover:bg-secondary/10 hover:shadow-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Check className="size-4 shrink-0 text-secondary" />
                      <span className="truncate font-medium">{r.title}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      {t('cook.items', { n: r.total })}
                      <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Almost there */}
          {almost.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent/25" aria-hidden>
                  🟡
                </span>
                <h2 className="font-serif text-lg text-primary">{t('cook.almost')}</h2>
                <CountBadge tone="accent">{almost.length}</CountBadge>
              </div>
              <div className="space-y-2">
                {almost.map((r) => (
                  <Link
                    key={r.id}
                    href={`/recipes/${r.id}`}
                    className="group block rounded-xl border bg-card px-4 py-3 transition hover:border-accent/50 hover:bg-accent/5 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{r.title}</span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{t('cook.stillNeed')}</span>
                      {r.missing.map((m) => (
                        <span key={m} className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-foreground">
                          {displayOf(m)}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
