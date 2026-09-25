import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { AppNav } from '@/components/app-nav'
import { WeekPlanner } from '@/components/week-planner'
import { RememberPlanWeek } from '@/components/remember-plan-week'
import { getRoom } from '@/lib/data/rooms'
import { getWeekPlan } from '@/lib/data/meal-plan'
import { listRecipes } from '@/lib/data/recipes'
import { getWeekStartsOn } from '@/lib/data/profile'
import { startOfWeek, toISODate } from '@/lib/plan/week'
import { weekToOpen } from '@/lib/plan/last-week'
import { getT } from '@/lib/i18n-server'

export default async function RoomPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>
  searchParams: Promise<{ week?: string }>
}) {
  const { roomId } = await params
  const { week } = await searchParams
  const weekStartsOn = await getWeekStartsOn()
  const todayWeekISO = toISODate(startOfWeek(new Date(), weekStartsOn))
  const remembered = (await cookies()).get('last_plan_week')?.value
  const weekStartISO = weekToOpen(week, remembered, todayWeekISO, weekStartsOn)
  // Keep the URL honest about the week on screen so it stays shareable and
  // reloadable. Only fires when the remembered week moved us off today.
  if (!week && weekStartISO !== todayWeekISO) redirect(`/rooms/${roomId}/plan?week=${weekStartISO}`)

  const [room, entries, recipes, t] = await Promise.all([
    getRoom(roomId), getWeekPlan(weekStartISO, roomId), listRecipes(roomId), getT(),
  ])
  if (!room) notFound()
  return (
    <>
      <RememberPlanWeek weekStartISO={weekStartISO} />
      <AppNav roomId={roomId} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl text-primary">{t('plan.roomTitle', { room: room.name })}</h1>
        <WeekPlanner weekStartISO={weekStartISO} todayWeekISO={todayWeekISO} entries={entries} recipes={recipes} roomId={roomId} weekStartsOn={weekStartsOn} />
      </main>
    </>
  )
}
