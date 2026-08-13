import { PageSkeleton, RowsSkeleton, Shimmer } from '@/components/skeletons'

export default function Loading() {
  return (
    <PageSkeleton width="2xl">
      <Shimmer className="mb-4 h-8 w-44" />
      <RowsSkeleton count={4} />
      <Shimmer className="mt-6 h-24 rounded-xl" />
    </PageSkeleton>
  )
}
