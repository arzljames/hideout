import { useQuery } from '@tanstack/react-query'
import { ScrollArea } from '@/components/ui/scroll-area'
import { meQueryOptions } from '@/features/auth'
import { cn } from '@/lib/utils'
import { groupMembersByRole } from '../member-groups'
import type { Member } from '../types'
import { MemberSection } from './member-section'

interface MemberListProps {
  members: Member[]
  className?: string
}

/** Room members grouped Owner / Admins / Members. TODO(perf): virtualize past ~200 members. */
export function MemberList({ members, className }: MemberListProps) {
  const viewerId = useQuery(meQueryOptions).data?.id

  return (
    <aside aria-label="Members" className={cn('flex min-h-0 flex-col bg-sidebar', className)}>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-3">
          {groupMembersByRole(members).map((group) => (
            <MemberSection
              key={group.role}
              title={group.title}
              members={group.members}
              viewerId={viewerId}
            />
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
}
