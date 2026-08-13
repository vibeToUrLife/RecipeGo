import { PageSkeleton, Shimmer } from '@/components/skeletons'

export default function Loading() {
  return (
    <PageSkeleton width="2xl">
      <Shimmer className="mb-4 h-8 w-40" />
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => <Shimmer key={i} className="h-20 rounded-xl" />)}
      </div>
      <Shimmer className="mt-6 h-24 rounded-xl" />
    </PageSkeleton>
  )
}
