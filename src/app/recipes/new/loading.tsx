import { PageSkeleton, FormSkeleton } from '@/components/skeletons'

export default function Loading() {
  return (
    <PageSkeleton width="2xl">
      <FormSkeleton withImportBar />
    </PageSkeleton>
  )
}
