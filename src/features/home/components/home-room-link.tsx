import { Link } from '@tanstack/react-router'
import { RoomIcon } from '@/components/room-icon'
import { Badge } from '@/components/ui/badge'
import type { MyRoom } from '@/features/rooms'
import { cn } from '@/lib/utils'

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin' } as const
const ROLE_BADGE = { owner: 'soft', admin: 'subtle' } as const

interface HomeRoomLinkProps {
  entry: MyRoom
  className?: string
}

/** A room on Home: icon, name and your role, linking to the room. */
export function HomeRoomLink({ entry, className }: HomeRoomLinkProps) {
  const { room, myRole } = entry

  return (
    <Link
      to="/rooms/$roomId"
      params={{ roomId: room.id }}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <RoomIcon icon={room.icon} name={room.name} size="md" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{room.name}</span>
      {myRole !== 'member' && (
        <Badge variant={ROLE_BADGE[myRole]} className="shrink-0">
          {ROLE_LABEL[myRole]}
        </Badge>
      )}
    </Link>
  )
}
