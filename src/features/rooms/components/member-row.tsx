import { cva } from 'class-variance-authority'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/user-avatar'
import { cn } from '@/lib/utils'
import type { RoomMember } from '../sample-room'

const memberNameVariants = cva('truncate text-sm font-medium', {
  variants: {
    presence: {
      online: 'text-foreground',
      offline: 'text-muted-foreground',
    },
  },
})

const memberStatusVariants = cva('truncate text-xs', {
  variants: {
    tone: {
      muted: 'text-muted-foreground',
      activity: 'text-primary',
    },
  },
})

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin' } as const
const ROLE_BADGE = { owner: 'soft', admin: 'subtle' } as const

interface MemberRowProps {
  member: RoomMember
  className?: string
}

/** One member in the member list: avatar with presence, name, role and status line. */
export function MemberRow({ member, className }: MemberRowProps) {
  const offline = member.presence === 'offline'
  const status = offline ? 'Offline' : (member.activity ?? 'Online')

  return (
    <li className={cn('flex items-center gap-2.5 rounded-md px-2 py-1.5', className)}>
      <UserAvatar
        name={member.name}
        tone={member.tone}
        status={member.presence}
        className={cn(offline && 'opacity-60')}
      />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5">
          <span className={memberNameVariants({ presence: member.presence })}>{member.name}</span>
          {member.isViewer && <span className="shrink-0 text-xs text-muted-foreground">(you)</span>}
          {member.role && (
            <Badge variant={ROLE_BADGE[member.role]} className="shrink-0">
              {ROLE_LABEL[member.role]}
            </Badge>
          )}
        </p>
        <p className={memberStatusVariants({ tone: member.activity && !offline ? 'activity' : 'muted' })}>
          {status}
        </p>
      </div>
    </li>
  )
}
