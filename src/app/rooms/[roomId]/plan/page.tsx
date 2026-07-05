import { notFound } from 'next/navigation'
import { AppNav } from '@/components/app-nav'
import { RoomSubNav } from '@/components/room-subnav'
import { WeekPlanner } from '@/components/week-planner'
import { getRoom } from '@/lib/data/rooms'
import { getWeekPlan } from '@/lib/data/meal-plan'
import { listRecipes } from '@/lib/data/recipes'
import { startOfWeek, fromISODate, toISODate } from '@/lib/plan/week'
import { getT } from '@/lib/i18n-server'

const ISO = /^\d{4}-\d{2}-\d{2}$/

export default async function RoomPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>
  searchParams: Promise<{ week?: string }>
}) {
  const { roomId } = await params
  const { week } = await searchParams
  const todayWeekISO = toISODate(startOfWeek(new Date()))
  const weekStartISO = week && ISO.test(week) ? toISODate(startOfWeek(fromISODate(week))) : todayWeekISO
  const [room, entries, recipes, t] = await Promise.all([
    getRoom(roomId), getWeekPlan(weekStartISO, roomId), listRecipes(roomId), getT(),
  ])
  if (!room) notFound()
  return (
    <>
      <AppNav roomId={roomId} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl text-primary">{t('plan.roomTitle', { room: room.name })}</h1>
        <RoomSubNav roomId={roomId} />
        <WeekPlanner weekStartISO={weekStartISO} todayWeekISO={todayWeekISO} entries={entries} recipes={recipes} roomId={roomId} />
      </main>
    </>
  )
}
