import { PageSkeleton, ShoppingListSkeleton } from '@/components/skeletons'

export default function Loading() {
  return (
    <PageSkeleton width="2xl">
      <ShoppingListSkeleton />
    </PageSkeleton>
  )
}
