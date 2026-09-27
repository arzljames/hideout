import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface InviteSkeletonProps {
  className?: string
}

/** Route-level loading for the invite page, shaped like the invite card. */
export function InviteSkeleton({ className }: InviteSkeletonProps) {
  return (
    <main
      aria-busy="true"
      aria-label="Loading invite"
      className={cn('flex min-h-svh items-center justify-center px-4 py-12', className)}
    >
      <Card className="w-full max-w-sm [--card-spacing:--spacing(8)]">
        <CardContent className="flex flex-col items-center gap-3">
          <Skeleton className="size-14 rounded-xl" />
          <Skeleton className="mt-2 h-4 w-40" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-10 w-full" />
        </CardContent>
      </Card>
    </main>
  )
}
