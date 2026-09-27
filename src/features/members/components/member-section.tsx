import { useId } from 'react'
import type { Member, Role } from '@/features/rooms'
import { sameRoomId } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { memberMenuEntries, type MemberMenuAction } from '../member-menu-entries'
import { memberActions } from '../permissions'
import { MemberRow } from './member-row'

interface MemberSectionProps {
  title: string
  members: Member[]
  /** The signed-in user's profile id, to mark their row "(you)". */
  viewerId: string | undefined
  viewerRole: Role
  onAction: (member: Member, action: MemberMenuAction, returnFocus: HTMLElement | null) => void
  busy?: boolean
  className?: string
}

/** A titled group of members ("Admins — 2"). Renders nothing when empty. */
export function MemberSection({
  title,
  members,
  viewerId,
  viewerRole,
  onAction,
  busy,
  className,
}: MemberSectionProps) {
  const headingId = useId()
  if (members.length === 0) return null

  return (
    <section aria-labelledby={headingId} className={cn(className)}>
      <h2
        id={headingId}
        className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        {title} — {members.length}
      </h2>
      <ul role="list" className="flex flex-col gap-0.5">
        {members.map((member) => (
          <MemberRow
            key={member.user.id}
            member={member}
            isViewer={viewerId !== undefined && sameRoomId(member.user.id, viewerId)}
            // UI-only gate; hideout-api enforces the role on every member write.
            entries={memberMenuEntries(member, memberActions(viewerRole, member, viewerId))}
            onAction={(action, returnFocus) => onAction(member, action, returnFocus)}
            busy={busy}
          />
        ))}
      </ul>
    </section>
  )
}
