import { PageSkeleton, Shimmer } from '@/components/skeletons'

export default function Loading() {
  return (
    <PageSkeleton width="3xl">
      <Shimmer className="mb-4 h-48 rounded-2xl" />
      <div className="flex items-start justify-between gap-3">
        <Shimmer className="h-9 w-2/3" />
        <div className="flex shrink-0 gap-2">
          <Shimmer className="h-8 w-20" />
          <Shimmer className="h-8 w-16" />
        </div>
      </div>
      <Shimmer className="mt-3 h-4 w-full max-w-prose" />
      <Shimmer className="mt-2 h-4 w-40" />
      <Shimmer className="my-4 h-10 w-48" />
      <Shimmer className="mb-6 h-10 w-full max-w-xs" />
      <div className="grid gap-6 sm:grid-cols-[40%_1fr]">
        <section className="space-y-2">
          <Shimmer className="h-3 w-24" />
          {Array.from({ length: 6 }, (_, i) => <Shimmer key={i} className="h-4 w-full" />)}
        </section>
        <section className="space-y-3">
          <Shimmer className="h-3 w-20" />
          {Array.from({ length: 5 }, (_, i) => <Shimmer key={i} className="h-10 w-full" />)}
        </section>
      </div>
    </PageSkeleton>
  )
}
