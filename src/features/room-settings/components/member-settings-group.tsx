import { useId } from 'react'
import type { Member, Role } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { MemberSettingsRow } from './member-settings-row'

interface MemberSettingsGroupProps {
  /** "Owner", "Admins" or "Members". */
  title: string
  members: Member[]
  viewerId: string | undefined
  viewerRole: Role
  roomName: string
  className?: string
}

/** One role group in Room settings → Members. Renders nothing when empty. */
export function MemberSettingsGroup({
  title,
  members,
  viewerId,
  viewerRole,
  roomName,
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
            isViewer={member.user.id === viewerId}
            roomName={roomName}
            viewerRole={viewerRole}
          />
        ))}
      </ul>
    </section>
  )
}
