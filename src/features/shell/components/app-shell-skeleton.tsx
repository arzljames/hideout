import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const RAIL_TILES = 3
const NAV_ROWS = ['w-24', 'w-32', 'w-20']

interface AppShellSkeletonProps {
  className?: string
}

/**
 * Route-level placeholder while the session loads: rail and nav panel on desktop (hidden below
 * `md`, where the sidebar is a sheet), a header bar and page content.
 */
export function AppShellSkeleton({ className }: AppShellSkeletonProps) {
  return (
    <div role="status" aria-label="Loading Hideout" className={cn('flex h-svh min-h-0', className)}>
      <div className="hidden shrink-0 border-r border-sidebar-border md:flex">
        <div className="flex w-14 flex-col items-center gap-2 border-r border-sidebar-border bg-sidebar-rail py-2">
          {Array.from({ length: RAIL_TILES + 1 }, (_, index) => (
            <Skeleton key={index} className="size-10 rounded-xl" />
          ))}
        </div>
        <div className="flex w-56 flex-col bg-sidebar">
          <div className="flex h-12 items-center border-b border-sidebar-border px-4">
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4">
            {NAV_ROWS.map((width, index) => (
              <Skeleton key={index} className={cn('h-3', width)} />
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-sidebar-border p-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <Skeleton className="size-4" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
      </div>
    </div>
  )
}
