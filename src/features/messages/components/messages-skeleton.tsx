import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const ROWS = [
  { name: 'w-24', lines: ['w-3/4'] },
  { name: 'w-16', lines: ['w-1/2', 'w-2/3'] },
  { name: 'w-20', lines: ['w-5/6'] },
  { name: 'w-28', lines: ['w-2/5', 'w-3/5'] },
]

interface MessagesSkeletonProps {
  className?: string
}

/** Placeholder message rows while a channel's history loads. */
export function MessagesSkeleton({ className }: MessagesSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading messages"
      className={cn('flex min-h-0 flex-1 flex-col justify-end gap-5 overflow-hidden px-4 pb-4', className)}
    >
      {ROWS.map((row, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <Skeleton className={cn('h-3.5', row.name)} />
            {row.lines.map((line, lineIndex) => (
              <Skeleton key={lineIndex} className={cn('h-3.5', line)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
