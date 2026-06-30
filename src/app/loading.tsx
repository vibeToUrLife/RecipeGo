// Shown instantly on every navigation (Next.js Suspense fallback) so a click
// never looks "frozen" while the server renders the next page.
export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="hidden gap-2 sm:flex">
            <div className="h-6 w-20 animate-pulse rounded bg-muted" />
            <div className="h-6 w-24 animate-pulse rounded bg-muted" />
            <div className="h-6 w-24 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-muted-foreground">
        <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="text-sm">Loading…</p>
      </div>
    </div>
  )
}
