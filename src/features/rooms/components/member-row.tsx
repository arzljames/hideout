import { UserAvatar } from '@/components/user-avatar'
import { cn } from '@/lib/utils'
import type { Member } from '../types'

interface MemberRowProps {
  member: Member
  isViewer: boolean
  className?: string
}

/** One member in the member list: avatar and name. TODO(presence): online state. */
export function MemberRow({ member, isViewer, className }: MemberRowProps) {
  const { displayName, avatarUrl } = member.user

  return (
    <li className={cn('flex items-center gap-2.5 rounded-md px-2 py-1.5', className)}>
      <UserAvatar name={displayName} src={avatarUrl} />
      <p className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
        {isViewer && <span className="shrink-0 text-xs text-muted-foreground">(you)</span>}
      </p>
    </li>
  )
}
