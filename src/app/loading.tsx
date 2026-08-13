import { PageSkeleton, HeroSkeleton, RecipeGridSkeleton, Shimmer } from '@/components/skeletons'

// Fallback for any segment without its own loading.tsx. Shaped like the recipe
// library, which is where most navigations land.
export default function Loading() {
  return (
    <PageSkeleton>
      <HeroSkeleton />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Shimmer className="h-9 w-full max-w-sm flex-1" />
        <div className="flex shrink-0 gap-2">
          <Shimmer className="h-9 w-24" />
          <Shimmer className="h-9 w-28" />
        </div>
      </div>
      <RecipeGridSkeleton />
    </PageSkeleton>
  )
}
