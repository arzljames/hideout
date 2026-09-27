import { useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { meQueryOptions } from '@/features/auth'
import { groupMembersByRole, type RoomDetail } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { useMemberActions } from '../hooks/use-member-actions'
import { MemberActionDialogs } from './member-action-dialogs'
import { MemberSection } from './member-section'

interface MemberListProps {
  room: RoomDetail
  className?: string
}

/**
 * Room members grouped Owner / Admins / Members, with per-member menus for what the viewer may
 * do. TODO(perf): virtualize past ~200 members.
 */
export function MemberList({ room, className }: MemberListProps) {
  const viewerId = useQuery(meQueryOptions).data?.id
  const asideRef = useRef<HTMLElement>(null)
  const actions = useMemberActions(room.room.id)

  return (
    <aside
      ref={asideRef}
      aria-label="Members"
      // Focus lands here when a confirmation closes after its member's row is gone.
      tabIndex={-1}
      className={cn('flex min-h-0 flex-col bg-sidebar outline-none', className)}
    >
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-3">
          {groupMembersByRole(room.members).map((group) => (
            <MemberSection
              key={group.role}
              title={group.title}
              members={group.members}
              viewerId={viewerId}
              viewerRole={room.myRole}
              onAction={actions.run}
              busy={actions.changingRole}
            />
          ))}
        </div>
      </ScrollArea>
      <MemberActionDialogs
        room={room}
        request={actions.request}
        open={actions.open}
        onOpenChange={actions.setOpen}
        fallbackFocus={() => asideRef.current}
      />
    </aside>
  )
}
