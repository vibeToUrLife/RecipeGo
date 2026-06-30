import { AppNav } from '@/components/app-nav'
import { WeekPlanner } from '@/components/week-planner'
import { getWeekPlan } from '@/lib/data/meal-plan'
import { listRecipes } from '@/lib/data/recipes'
import { startOfWeek, fromISODate, toISODate } from '@/lib/plan/week'
import { getT } from '@/lib/i18n-server'

const ISO = /^\d{4}-\d{2}-\d{2}$/

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const { week } = await searchParams
  const todayWeekISO = toISODate(startOfWeek(new Date()))
  const weekStartISO = week && ISO.test(week) ? toISODate(startOfWeek(fromISODate(week))) : todayWeekISO
  const [entries, recipes, t] = await Promise.all([getWeekPlan(weekStartISO), listRecipes(), getT()])
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl text-primary">{t('plan.title')}</h1>
        <WeekPlanner weekStartISO={weekStartISO} todayWeekISO={todayWeekISO} entries={entries} recipes={recipes} roomId={null} />
      </main>
    </>
  )
}
