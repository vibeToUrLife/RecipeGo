import { PageSkeleton, WeekPlannerSkeleton } from '@/components/skeletons'

export default function Loading() {
  return (
    <PageSkeleton width="3xl">
      <WeekPlannerSkeleton />
    </PageSkeleton>
  )
}
