'use client'
import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddMealDialog } from '@/components/add-meal-dialog'
import { PlannedMeal } from '@/components/planned-meal'
import {
  weekDays, fromISODate, toISODate, addWeeks, startOfWeek,
  groupEntriesByDayAndSlot, MEAL_SLOTS, type MealSlot,
} from '@/lib/plan/week'
import { addWeekToShoppingListAction } from '@/app/plan/actions'
import type { Recipe, MealPlanEntryView } from '@/lib/db-types'
import { useT } from '@/components/i18n-provider'

export function WeekPlanner({
  weekStartISO, entries, recipes, roomId,
}: {
  weekStartISO: string
  entries: MealPlanEntryView[]
  recipes: Recipe[]
  roomId: string | null
}) {
  const t = useT()
  const router = useRouter()
  const [pending, start] = useTransition()
  const base = roomId ? `/rooms/${roomId}/plan` : '/plan'
  const weekStart = fromISODate(weekStartISO)
  const days = weekDays(weekStart)
  const grouped = groupEntriesByDayAndSlot(entries)
  const prev = toISODate(addWeeks(weekStart, -1))
  const next = toISODate(addWeeks(weekStart, 1))
  const thisWeek = toISODate(startOfWeek(new Date()))
  const slotLabel: Record<MealSlot, string> = {
    breakfast: t('plan.breakfast'), lunch: t('plan.lunch'), dinner: t('plan.dinner'),
  }
  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon" className="h-8 w-8" aria-label={t('plan.prevWeek')}>
            <Link href={`${base}?week=${prev}`}><ChevronLeft className="size-4" /></Link>
          </Button>
          <Button asChild variant="outline" size="sm"><Link href={`${base}?week=${thisWeek}`}>{t('plan.thisWeek')}</Link></Button>
          <Button asChild variant="outline" size="icon" className="h-8 w-8" aria-label={t('plan.nextWeek')}>
            <Link href={`${base}?week=${next}`}><ChevronRight className="size-4" /></Link>
          </Button>
        </div>
        <Button
          disabled={pending || entries.length === 0}
          onClick={() => start(async () => {
            const res = await addWeekToShoppingListAction(weekStartISO, roomId)
            toast.success(t('plan.addedMeals', { n: res.meals }))
            router.push(roomId ? `/rooms/${roomId}/shopping-list` : '/shopping-list')
          })}
        >
          {t('plan.addWeekToList')}
        </Button>
      </div>

      <div className="grid gap-3">
        {days.map((d) => {
          const iso = toISODate(d)
          const day = grouped[iso] ?? { breakfast: [], lunch: [], dinner: [] }
          return (
            <div key={iso} className="rounded-xl border bg-card p-3">
              <p className="mb-2 font-serif text-sm font-semibold text-primary">{dayFmt.format(d)}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {MEAL_SLOTS.map((slot) => (
                  <div key={slot} className="rounded-lg bg-muted/40 p-2">
                    <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{slotLabel[slot]}</p>
                    <div className="flex flex-col gap-1">
                      {day[slot].map((e) => <PlannedMeal key={e.id} entry={e} />)}
                      <AddMealDialog planDate={iso} slot={slot} recipes={recipes} roomId={roomId} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
