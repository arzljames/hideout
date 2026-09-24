import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const LINE_WIDTHS = ['w-2/3', 'w-1/2', 'w-3/4', 'w-2/5']

interface RoomSkeletonProps {
  className?: string
}

/** Route-level placeholder while a room loads: header, a few messages, composer, members. */
export function RoomSkeleton({ className }: RoomSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading room"
      className={cn('flex h-svh min-h-0', className)}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <Skeleton className="size-4" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-1 flex-col justify-end gap-5 p-4">
          {LINE_WIDTHS.map((width, index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className={cn('h-3', width)} />
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 pt-0">
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
      <div className="hidden w-60 shrink-0 flex-col gap-3 border-l border-sidebar-border bg-sidebar p-3 md:flex">
        <Skeleton className="h-3 w-20" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-2.5">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
