import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { Room } from '../sample-room'
import { MemberSection } from './member-section'

interface MemberListProps {
  room: Room
  className?: string
}

/** Room members grouped by presence. TODO(perf): virtualize past ~200 members. */
export function MemberList({ room, className }: MemberListProps) {
  const online = room.members.filter((member) => member.presence === 'online')
  const offline = room.members.filter((member) => member.presence === 'offline')

  return (
    <aside aria-label="Members" className={cn('flex min-h-0 flex-col bg-sidebar', className)}>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-3">
          <MemberSection title="Online" members={online} />
          <MemberSection title="Offline" members={offline} />
        </div>
      </ScrollArea>
    </aside>
  )
}
