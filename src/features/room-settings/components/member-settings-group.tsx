import { useId } from 'react'
import { memberActions, memberMenuEntries, type MemberMenuAction } from '@/features/members'
import { sameRoomId, type Member, type Role } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { MemberSettingsRow } from './member-settings-row'

interface MemberSettingsGroupProps {
  /** "Owner", "Admins" or "Members". */
  title: string
  members: Member[]
  viewerId: string | undefined
  viewerRole: Role
  onAction: (member: Member, action: MemberMenuAction, returnFocus: HTMLElement | null) => void
  busy?: boolean
  className?: string
}

/** One role group in Room settings → Members. Renders nothing when empty. */
export function MemberSettingsGroup({
  title,
  members,
  viewerId,
  viewerRole,
  onAction,
  busy,
  className,
}: MemberSettingsGroupProps) {
  const headingId = useId()
  if (members.length === 0) return null

  return (
    <section aria-labelledby={headingId} className={cn('flex flex-col gap-1', className)}>
      <h2
        id={headingId}
        className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        {title} — {members.length}
      </h2>
      <ul role="list" aria-labelledby={headingId} className="divide-y divide-border">
        {members.map((member) => (
          <MemberSettingsRow
            key={member.user.id}
            member={member}
            isViewer={viewerId !== undefined && sameRoomId(member.user.id, viewerId)}
            // UI-only gate; hideout-api enforces the role on every member write. Transfer
            // ownership lives in Overview → Danger zone here.
            entries={memberMenuEntries(member, memberActions(viewerRole, member, viewerId), {
              transfer: false,
            })}
            onAction={(action, returnFocus) => onAction(member, action, returnFocus)}
            busy={busy}
          />
        ))}
      </ul>
    </section>
  )
}
