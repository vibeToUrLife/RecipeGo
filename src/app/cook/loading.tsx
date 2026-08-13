import { PageSkeleton, HeroSkeleton, RecipeGridSkeleton, Shimmer } from '@/components/skeletons'

export default function Loading() {
  return (
    <PageSkeleton>
      <HeroSkeleton />
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 10 }, (_, i) => <Shimmer key={i} className="h-8 w-24 rounded-full" />)}
      </div>
      <RecipeGridSkeleton count={3} />
    </PageSkeleton>
  )
}
