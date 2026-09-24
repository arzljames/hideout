import { LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { UserAvatar } from '@/components/user-avatar'
import { cn } from '@/lib/utils'
import type { ShellViewer } from '../sample-viewer'

interface UserCardProps {
  user: ShellViewer
  className?: string
}

/** Signed-in user's name and presence, with account actions. */
export function UserCard({ user, className }: UserCardProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <UserAvatar name={user.name} tone={user.tone} status="online" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="text-xs text-muted-foreground">Online</p>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          {/* TODO(settings): navigate to account settings once the route exists. */}
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Settings">
            <Settings aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Settings</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          {/* TODO(auth): sign out through the API, clear the query cache, then redirect to /sign-in. */}
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Sign out">
            <LogOut aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Sign out</TooltipContent>
      </Tooltip>
    </div>
  )
}
