import type { ComponentProps } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserAvatar } from '@/components/user-avatar'
import { cn } from '@/lib/utils'

interface TopBarProps {
  user: {
    name: string
    tone?: ComponentProps<typeof UserAvatar>['tone']
  }
  className?: string
}

export function TopBar({ user, className }: TopBarProps) {
  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:px-6',
        className,
      )}
    >
      {/* TODO(app-shell): make this a typed <Link to="/"> once the app shell exists. */}
      <span className="font-heading text-base font-semibold tracking-tight">Hideout</span>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserAvatar name={user.name} tone={user.tone} size="sm" status="online" />
        <span className="max-w-32 truncate text-sm font-medium">{user.name}</span>
      </div>
    </header>
  )
}
