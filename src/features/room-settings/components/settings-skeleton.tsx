import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface SettingsSkeletonProps {
  className?: string
}

/** Route-level placeholder while Room settings loads. */
export function SettingsSkeleton({ className }: SettingsSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading room settings"
      className={cn('flex min-h-svh bg-background', className)}
    >
      <div className="hidden w-64 shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-7 w-full" />
        ))}
      </div>
      <div className="flex-1 px-4 py-10 md:px-10">
        <div className="mx-auto flex max-w-xl flex-col gap-6">
          <Skeleton className="h-7 w-32" />
          <div className="flex items-center gap-4">
            <Skeleton className="size-14 rounded-xl" />
            <Skeleton className="h-8 w-32" />
          </div>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
    </div>
  )
}
