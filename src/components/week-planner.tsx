'use client'
import Link from 'next/link'
import { useOptimistic, useState, useTransition, type DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddMealDialog } from '@/components/add-meal-dialog'
import { PlannedMeal } from '@/components/planned-meal'
import { PrintButton } from '@/components/print-button'
import {
  weekDays, fromISODate, toISODate, addWeeks,
  groupEntriesByDayAndSlot, MEAL_SLOTS, type MealSlot,
} from '@/lib/plan/week'
import { PLAN_ENTRY_DRAG_TYPE } from '@/lib/plan/drag'
import { addWeekToShoppingListAction, movePlanEntryAction, setPlanEntryEatenAction } from '@/app/plan/actions'
import { WeekStartSelector } from '@/components/week-start-selector'
import type { Recipe, MealPlanEntryView } from '@/lib/db-types'
import { useT, useLocale } from '@/components/i18n-provider'
import { cn } from '@/lib/utils'

// Within a slot, meals keep the order they were added in (the server only sorts
// by day), so one dropped into a busy slot lands where it will stay.
function byAdded(a: MealPlanEntryView, b: MealPlanEntryView) {
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
}

export function WeekPlanner({
  weekStartISO, todayWeekISO, entries, recipes, roomId, weekStartsOn,
}: {
  weekStartISO: string
  todayWeekISO: string
  entries: MealPlanEntryView[]
  recipes: Recipe[]
  roomId: string | null
  weekStartsOn: number
}) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(entries)
  const [, startMove] = useTransition()
  const [, startEaten] = useTransition()
  const [dropCell, setDropCell] = useState<string | null>(null)
  const base = roomId ? `/rooms/${roomId}/plan` : '/plan'
  const weekStart = fromISODate(weekStartISO)
  const days = weekDays(weekStart)
  const grouped = groupEntriesByDayAndSlot([...optimistic].sort(byAdded))
  const prev = toISODate(addWeeks(weekStart, -1))
  const next = toISODate(addWeeks(weekStart, 1))
  const thisWeek = todayWeekISO
  const slotLabel: Record<MealSlot, string> = {
    breakfast: t('plan.breakfast'), lunch: t('plan.lunch'), dinner: t('plan.dinner'),
  }
  // Pin an explicit locale (matching the app's i18n locale, which is identical
  // on server and client) so both renders produce the same date string. Passing
  // `undefined` resolves to the runtime default — different on Node vs the
  // browser — which caused a hydration mismatch.
  const dayFmt = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
  // Date range of the week currently in view (start – end), shown between the
  // arrows so the label changes as you navigate. Same pinned locale as dayFmt to
  // stay hydration-safe (two .format() calls, matching the proven day-cell pattern).
  const rangeFmt = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
    day: 'numeric', month: 'short',
  })
  const weekRangeLabel = `${rangeFmt.format(weekStart)} – ${rangeFmt.format(days[days.length - 1])}`
  const onCurrentWeek = weekStartISO === todayWeekISO

  // Drag and drop (computers only — see PlannedMeal): a slot takes a meal
  // dragged from the grid, and lights up while one is held over it.
  function allowMealDrop(e: DragEvent, cell: string) {
    if (!e.dataTransfer.types.includes(PLAN_ENTRY_DRAG_TYPE)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropCell(cell)
  }

  function dropMeal(e: DragEvent, planDate: string, slot: MealSlot) {
    const id = e.dataTransfer.getData(PLAN_ENTRY_DRAG_TYPE)
    if (!id) return
    e.preventDefault()
    setDropCell(null)
    const entry = optimistic.find((x) => x.id === id)
    // Only a meal from this week's grid (one dragged in from another tab would be
    // moved without ever showing here), and only to somewhere new.
    if (!entry || (entry.plan_date === planDate && entry.meal_slot === slot)) return
    startMove(async () => {
      setOptimistic((prev) => prev.map((x) => (x.id === id ? { ...x, plan_date: planDate, meal_slot: slot } : x)))
      try {
        const res = await movePlanEntryAction(id, planDate, slot)
        if (res.error) toast.error(res.error)
      } catch {
        toast.error(t('common.errorRetry'))
      }
    })
  }

  // Eaten: the meal comes off the plan at once. Its row is only marked, not
  // deleted, so Undo on the toast can put it back.
  function markEaten(entry: MealPlanEntryView) {
    startEaten(async () => {
      setOptimistic((prev) => prev.filter((x) => x.id !== entry.id))
      try {
        const res = await setPlanEntryEatenAction(entry.id, true)
        if (res.error) { toast.error(res.error); return }
        toast.success(t('plan.markedEaten', { meal: entry.recipe_title }), {
          action: { label: t('common.undo'), onClick: () => unmarkEaten(entry) },
        })
      } catch {
        toast.error(t('common.errorRetry'))
      }
    })
  }

  function unmarkEaten(entry: MealPlanEntryView) {
    startEaten(async () => {
      // Back at once too, unless the server's copy still has it.
      setOptimistic((prev) => (prev.some((x) => x.id === entry.id) ? prev : [...prev, entry]))
      try {
        const res = await setPlanEntryEatenAction(entry.id, false)
        if (res.error) toast.error(res.error)
      } catch {
        toast.error(t('common.errorRetry'))
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Everything here is screen-only except the week-range label, which is
          the printed sheet's only clue about which week it covers. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button asChild variant="outline" size="icon" className="h-8 w-8 print:hidden" aria-label={t('plan.prevWeek')}>
              <Link href={`${base}?week=${prev}`}><ChevronLeft className="size-4" /></Link>
            </Button>
            <span className="min-w-[8rem] text-center text-sm font-medium tabular-nums print:min-w-0 print:text-left" aria-live="polite">
              {weekRangeLabel}
            </span>
            <Button asChild variant="outline" size="icon" className="h-8 w-8 print:hidden" aria-label={t('plan.nextWeek')}>
              <Link href={`${base}?week=${next}`}><ChevronRight className="size-4" /></Link>
            </Button>
            {!onCurrentWeek && (
              <Button asChild variant="outline" size="sm" className="print:hidden">
                <Link href={`${base}?week=${thisWeek}`}>{t('plan.thisWeek')}</Link>
              </Button>
            )}
          </div>
          <div className="print:hidden">
            <WeekStartSelector value={weekStartsOn} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <PrintButton size="default" label={t('print.plan')} hint={t('print.hint')} />
          <Button
            disabled={pending || entries.length === 0}
            onClick={() => start(async () => {
              const res = await addWeekToShoppingListAction(weekStartISO, roomId)
              if (res.error) { toast.error(res.error); return }
              toast.success(t('plan.addedMeals', { n: res.meals ?? 0 }))
              router.push(roomId ? `/rooms/${roomId}/shopping-list` : '/shopping-list')
            })}
          >
            {t('plan.addWeekToList')}
          </Button>
        </div>
      </div>

      <div className="grid gap-3" onDragEnd={() => setDropCell(null)}>
        {days.map((d) => {
          const iso = toISODate(d)
          const day = grouped[iso] ?? { breakfast: [], lunch: [], dinner: [] }
          return (
            <div key={iso} className="rounded-xl border bg-card p-3 print:break-inside-avoid">
              <p className="mb-2 font-serif text-sm font-semibold text-primary">{dayFmt.format(d)}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {MEAL_SLOTS.map((slot) => {
                  const cell = `${iso} ${slot}`
                  return (
                    // Slot fills don't print, so borrow a border to keep the three
                    // columns readable on paper.
                    <div
                      key={slot}
                      onDragEnter={(e) => allowMealDrop(e, cell)}
                      onDragOver={(e) => allowMealDrop(e, cell)}
                      onDragLeave={(e) => {
                        // Moving onto one of its own children isn't leaving.
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                          setDropCell((c) => (c === cell ? null : c))
                        }
                      }}
                      onDrop={(e) => dropMeal(e, iso, slot)}
                      className={cn(
                        'rounded-lg bg-muted/40 p-2 print:border',
                        dropCell === cell && 'bg-primary/10 ring-2 ring-primary/40',
                      )}
                    >
                      <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{slotLabel[slot]}</p>
                      <div className="flex flex-col gap-1">
                        {day[slot].map((e) => <PlannedMeal key={e.id} entry={e} onEaten={() => markEaten(e)} />)}
                        <div className="print:hidden">
                          <AddMealDialog planDate={iso} slot={slot} recipes={recipes} roomId={roomId} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
