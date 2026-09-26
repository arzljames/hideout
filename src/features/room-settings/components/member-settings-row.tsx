import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/user-avatar'
import type { RoomMember, RoomRole } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { MemberActionsMenu } from './member-actions-menu'

// joinedAt is a date-only ISO string, which Date parses as UTC midnight; format in UTC so the
// calendar month doesn't slip back a day west of UTC.
const joinedFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin' } as const
const ROLE_BADGE = { owner: 'soft', admin: 'subtle' } as const

/**
 * Who may act on whom (design rule until the API decides):
 * - nobody acts on the owner or on themselves;
 * - the owner can change roles and remove anyone else;
 * - admins can only remove plain members (not other admins) and can't change roles.
 */
// UI-only gate; hideout-api must enforce the role on every settings mutation (expect 403 handling when wired).
function permissions(viewerRole: RoomRole, member: RoomMember) {
  if (member.isViewer || member.role === 'owner') return null
  if (viewerRole === 'owner') return { canChangeRole: true }
  if (viewerRole === 'admin' && member.role !== 'admin') return { canChangeRole: false }
  return null
}

interface MemberSettingsRowProps {
  member: RoomMember
  roomName: string
  viewerRole: RoomRole
  className?: string
}

/** A member in Room settings: presence avatar, name, role, join date and actions. */
export function MemberSettingsRow({
  member,
  roomName,
  viewerRole,
  className,
}: MemberSettingsRowProps) {
  const allowed = permissions(viewerRole, member)

  return (
    <li className={cn('flex items-center gap-3 py-2.5', className)}>
      <UserAvatar name={member.name} tone={member.tone} status={member.presence} />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{member.name}</span>
          {member.isViewer && (
            <span className="shrink-0 text-xs font-normal text-muted-foreground">(you)</span>
          )}
          {member.role && (
            <Badge variant={ROLE_BADGE[member.role]} className="shrink-0">
              {ROLE_LABEL[member.role]}
            </Badge>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          Joined <time dateTime={member.joinedAt}>{joinedFormat.format(new Date(member.joinedAt))}</time>
        </p>
      </div>
      {allowed && (
        <MemberActionsMenu
          member={member}
          roomName={roomName}
          canChangeRole={allowed.canChangeRole}
        />
      )}
    </li>
  )
}
