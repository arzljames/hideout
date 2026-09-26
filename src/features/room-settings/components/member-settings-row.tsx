import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/user-avatar'
import type { Member, Role } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { MemberActionsMenu } from './member-actions-menu'

// joinedAt is a full timestamp, so the month is shown in the viewer's own time zone.
const joinedFormat = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' })

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin' } as const
const ROLE_BADGE = { owner: 'soft', admin: 'subtle' } as const

/**
 * Who may act on whom (design rule; the API decides):
 * - nobody acts on the owner or on themselves;
 * - the owner can change roles and remove anyone else;
 * - admins can only remove plain members (not other admins) and can't change roles.
 */
// UI-only gate; hideout-api enforces the role on every member mutation.
function permissions(viewerRole: Role, member: Member, isViewer: boolean) {
  if (isViewer || member.role === 'owner') return null
  if (viewerRole === 'owner') return { canChangeRole: true }
  if (viewerRole === 'admin' && member.role !== 'admin') return { canChangeRole: false }
  return null
}

interface MemberSettingsRowProps {
  member: Member
  /** This row is the signed-in user. */
  isViewer: boolean
  roomName: string
  viewerRole: Role
  className?: string
}

/** A member in Room settings: avatar, name, role, join date and actions. */
export function MemberSettingsRow({
  member,
  isViewer,
  roomName,
  viewerRole,
  className,
}: MemberSettingsRowProps) {
  const allowed = permissions(viewerRole, member, isViewer)
  const { displayName, avatarUrl } = member.user

  return (
    <li className={cn('flex items-center gap-3 py-2.5', className)}>
      <UserAvatar name={displayName} src={avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{displayName}</span>
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
      {allowed && (
        <MemberActionsMenu
          memberName={displayName}
          memberRole={member.role}
          roomName={roomName}
          canChangeRole={allowed.canChangeRole}
        />
      )}
    </li>
  )
}
