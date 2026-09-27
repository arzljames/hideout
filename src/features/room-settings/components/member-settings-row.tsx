import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/user-avatar'
import type { MemberMenuAction, MemberMenuEntry } from '@/features/members'
import type { Member } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { MemberActionsMenu } from './member-actions-menu'

// joinedAt is a full timestamp, so the month is shown in the viewer's own time zone.
const joinedFormat = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' })

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin' } as const
const ROLE_BADGE = { owner: 'soft', admin: 'subtle' } as const

interface MemberSettingsRowProps {
  member: Member
  /** This row is the signed-in user. */
  isViewer: boolean
  /** What the viewer may do to this member (see memberActions); none → no menu. */
  entries?: MemberMenuEntry[]
  onAction?: (action: MemberMenuAction, returnFocus: HTMLElement | null) => void
  busy?: boolean
  className?: string
}

/** A member in Room settings: avatar, name, role, join date and actions. */
export function MemberSettingsRow({
  member,
  isViewer,
  entries = [],
  onAction,
  busy,
  className,
}: MemberSettingsRowProps) {
  const { displayName, avatarUrl } = member.user

  return (
    <li className={cn('flex items-center gap-3 py-2.5', className)}>
      <UserAvatar name={displayName} src={avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          <bdi className="truncate">{displayName}</bdi>
          {isViewer && (
            <span className="shrink-0 text-xs font-normal text-muted-foreground">(you)</span>
          )}
          {member.role !== 'member' && (
            <Badge variant={ROLE_BADGE[member.role]} className="shrink-0">
              {ROLE_LABEL[member.role]}
            </Badge>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          Joined{' '}
          <time dateTime={member.joinedAt}>{joinedFormat.format(new Date(member.joinedAt))}</time>
        </p>
      </div>
      {entries.length > 0 && onAction && (
        <MemberActionsMenu
          memberName={displayName}
          entries={entries}
          onAction={onAction}
          busy={busy}
        />
      )}
    </li>
  )
}
