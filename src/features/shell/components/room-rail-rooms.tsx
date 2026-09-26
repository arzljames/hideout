import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { RotateCw } from 'lucide-react'
import { RoomIcon } from '@/components/room-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { roomsQueryOptions } from '@/features/rooms'

const SKELETON_TILES = 3

interface RoomRailRoomsProps {
  /** The room in the URL, if any. */
  activeRoomId: string | undefined
  /** Tooltip props for a rail button (undefined on mobile, where tooltips are dropped). */
  railTooltip: (label: string) => { children: string; hidden: boolean } | undefined
}

/**
 * The user's rooms in the rail: skeleton tiles while loading, one tile per room once loaded
 * (kept if a background refetch fails), and a retry button only when there's nothing to show
 * (the rest of the app keeps working).
 */
export function RoomRailRooms({ activeRoomId, railTooltip }: RoomRailRoomsProps) {
  const rooms = useQuery(roomsQueryOptions)

  if (rooms.isPending) {
    return (
      <>
        {Array.from({ length: SKELETON_TILES }, (_, index) => (
          <SidebarMenuItem key={index} aria-hidden="true">
            <Skeleton className="size-10 rounded-lg" />
          </SidebarMenuItem>
        ))}
        <li className="sr-only">
          <span role="status">Loading rooms</span>
        </li>
      </>
    )
  }

  if (!rooms.data) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          type="button"
          size="rail"
          aria-label="Couldn't load rooms. Retry"
          tooltip={railTooltip("Couldn't load rooms. Retry")}
          disabled={rooms.isFetching}
          onClick={() => void rooms.refetch()}
        >
          <RotateCw aria-hidden="true" className="text-destructive" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <>
      {rooms.data.map(({ room }) => (
        <SidebarMenuItem key={room.id}>
          <SidebarMenuButton
            asChild
            size="rail"
            indicator="pill"
            isActive={room.id === activeRoomId}
            tooltip={railTooltip(room.name)}
          >
            <Link to="/rooms/$roomId" params={{ roomId: room.id }} aria-label={room.name}>
              <RoomIcon icon={room.icon} name={room.name} size="sm" />
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </>
  )
}
