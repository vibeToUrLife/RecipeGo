import { LoadingLabel } from '@/components/loading-label'
import { cn } from '@/lib/utils'

// Content-shaped loading UI. The point of these is that a navigation looks like
// the page filling in rather than the app blinking out: every skeleton mirrors
// the real screen's chrome (same nav bar, same max width, same grid) so nothing
// jumps when the server content swaps in.
//
// All of it is decoration — `LoadingLabel` carries the announcement, and the
// visuals are hidden from assistive tech.

export function Shimmer({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-muted', className)} />
}

/** Mirrors <AppNav />: sticky, bordered, same max width and padding. */
export function NavSkeleton() {
  return (
    <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
        <Shimmer className="h-7 w-36" />
        <div className="flex items-center gap-2">
          <Shimmer className="hidden h-7 w-24 md:block" />
          <Shimmer className="hidden h-7 w-20 md:block" />
          <Shimmer className="size-7 rounded-md" />
          <Shimmer className="size-7 rounded-md" />
        </div>
      </div>
    </header>
  )
}

/** The gradient banner at the top of the library / cook / plan screens. */
export function HeroSkeleton() {
  return (
    <section className="mb-6 rounded-2xl bg-gradient-to-br from-accent to-primary p-6">
      <Shimmer className="h-3 w-28 bg-primary-foreground/25" />
      <Shimmer className="mt-3 h-8 w-64 max-w-full bg-primary-foreground/25" />
    </section>
  )
}

export function RecipeGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border">
          <Shimmer className="h-40 rounded-none" />
          <div className="space-y-2 p-3">
            <Shimmer className="h-5 w-3/4" />
            <Shimmer className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function RowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="space-y-0">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-3 border-b py-3">
          <Shimmer className="size-4 shrink-0 rounded-sm" />
          <Shimmer className="h-4 flex-1" />
          <Shimmer className="h-4 w-12 shrink-0" />
        </li>
      ))}
    </ul>
  )
}

/** The recipe form (new + edit): import bar, fields, ingredient and step rows. */
export function FormSkeleton({ withImportBar = false }: { withImportBar?: boolean }) {
  return (
    <>
      <Shimmer className="mb-4 h-8 w-48" />
      {withImportBar && <Shimmer className="mb-5 h-32 rounded-xl" />}
      <div className="space-y-5">
        <Shimmer className="h-32 rounded-xl" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-9 w-full" />
          </div>
        ))}
        <div className="space-y-2">
          <Shimmer className="h-4 w-28" />
          {Array.from({ length: 4 }, (_, i) => <Shimmer key={i} className="h-9 w-full" />)}
        </div>
        <div className="space-y-2">
          <Shimmer className="h-4 w-20" />
          {Array.from({ length: 3 }, (_, i) => <Shimmer key={i} className="h-20 w-full" />)}
        </div>
        <Shimmer className="h-9 w-full" />
      </div>
    </>
  )
}

/** The shopping list: add-item bar, progress meter, aisle-grouped rows. */
export function ShoppingListSkeleton() {
  return (
    <>
      <Shimmer className="mb-4 h-8 w-48" />
      <div className="space-y-5">
        <Shimmer className="h-16 rounded-xl" />
        <div>
          <Shimmer className="h-3 w-32" />
          <Shimmer className="mt-1 h-2 w-full rounded-full" />
        </div>
        {Array.from({ length: 2 }, (_, g) => (
          <section key={g} className="space-y-1">
            <Shimmer className="h-3 w-24" />
            <RowsSkeleton count={4} />
          </section>
        ))}
      </div>
    </>
  )
}

/** The weekly planner grid: seven day columns of meal slots. */
export function WeekPlannerSkeleton() {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Shimmer className="h-8 w-40" />
        <Shimmer className="h-9 w-44" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="rounded-xl border p-3">
            <Shimmer className="h-4 w-28" />
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, j) => <Shimmer key={j} className="h-14 rounded-lg" />)}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

/** Wraps a skeleton in the same nav + <main> shell every real page uses. */
const WIDTHS = { '2xl': 'max-w-2xl', '3xl': 'max-w-3xl', '5xl': 'max-w-5xl' } as const

export function PageSkeleton({
  children,
  width = '5xl',
}: {
  children: React.ReactNode
  width?: keyof typeof WIDTHS
}) {
  return (
    <>
      <LoadingLabel />
      <div aria-hidden="true">
        <NavSkeleton />
        <main className={cn('mx-auto px-4 py-6', WIDTHS[width])}>{children}</main>
      </div>
    </>
  )
}
