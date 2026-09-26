import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface HomeRoomsSkeletonProps {
  className?: string
}

/** Placeholder room rows while the room list loads. */
export function HomeRoomsSkeleton({ className }: HomeRoomsSkeletonProps) {
  return (
    <div role="status" aria-label="Loading rooms" className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-lg border border-border p-3">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="h-4 w-40" />
        </div>
      ))}
    </div>
  )
}
