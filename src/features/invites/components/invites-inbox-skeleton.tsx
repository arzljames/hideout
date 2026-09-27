import { Inbox } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface InvitesInboxSkeletonProps {
  className?: string
}

/** Route-level loading for the Invites page. */
export function InvitesInboxSkeleton({ className }: InvitesInboxSkeletonProps) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <AppHeader title="Invites" icon={<Inbox aria-hidden="true" />} />
      <div aria-busy="true" aria-label="Loading invites" className="mx-auto flex w-full max-w-xl flex-col gap-3 p-4 md:py-8">
        {[0, 1].map((key) => (
          <Skeleton key={key} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
