import { PageSkeleton, Shimmer } from '@/components/skeletons'

export default function Loading() {
  return (
    <PageSkeleton width="3xl">
      <div className="flex flex-col items-center gap-6 py-6">
        <Shimmer className="h-8 w-56" />
        <Shimmer className="size-64 rounded-full" />
        <Shimmer className="h-10 w-36" />
      </div>
    </PageSkeleton>
  )
}
