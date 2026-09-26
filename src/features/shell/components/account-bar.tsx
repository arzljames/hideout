import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AccountMenu, type Me } from '@/features/auth'
import { cn } from '@/lib/utils'

interface AccountBarProps {
  /** `undefined` while the session is loading; `null` when there's no session to show. */
  user: Me | null | undefined
  className?: string
}

/** Nav panel footer: the account menu and the Settings button. */
export function AccountBar({ user, className }: AccountBarProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {user ? (
        <AccountMenu user={user} className="min-w-0 flex-1" />
      ) : (
        <div aria-hidden="true" className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1">
          {user === undefined && (
            <>
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </>
          )}
        </div>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          {/* TODO(settings): navigate to account settings once the route exists. */}
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Settings">
            <Settings aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Settings</TooltipContent>
      </Tooltip>
    </div>
  )
}
