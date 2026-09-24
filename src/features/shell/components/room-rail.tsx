import { Link, useMatchRoute, useParams } from '@tanstack/react-router'
import { Inbox, Plus } from 'lucide-react'
import { RoomIcon } from '@/components/room-icon'
import { Badge } from '@/components/ui/badge'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { usePendingInviteCount } from '@/features/invites'
import { CreateRoomDialog, sampleRooms } from '@/features/rooms'
import { cn } from '@/lib/utils'

interface RoomRailProps {
  className?: string
}

/** Narrow far-left column: Home, the user's rooms, and Create a room. */
export function RoomRail({ className }: RoomRailProps) {
  // Rail buttons are icon-only, so show their tooltips on desktop even while expanded. Drop
  // them in the mobile sheet: focus lands on Home when it opens, and an open tooltip would
  // swallow the first Esc. (`hidden: true` isn't enough; the tooltip still opens and
  // handles Esc, it just isn't displayed.)
  const { isMobile } = useSidebar()
  const railTooltip = (label: string) => (isMobile ? undefined : { children: label, hidden: false })

  const matchRoute = useMatchRoute()
  // Home covers the Home sections too (Invites), so its tile stays highlighted there.
  const isHome = Boolean(matchRoute({ to: '/' }) || matchRoute({ to: '/invites' }))
  const { roomId } = useParams({ strict: false })
  // TODO(api): rooms from the rooms query.
  const rooms = sampleRooms
  const pendingInvites = usePendingInviteCount()
  const homeLabel =
    pendingInvites > 0
      ? `Home, ${pendingInvites} pending ${pendingInvites === 1 ? 'invite' : 'invites'}`
      : 'Home'

  return (
    <nav
      aria-label="Rooms"
      className={cn(
        'flex w-14 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar-rail py-1',
        className,
      )}
    >
      <SidebarMenu className="items-center">
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            size="rail"
            indicator="pill"
            isActive={isHome}
            tooltip={railTooltip('Home')}
          >
            <Link to="/" aria-label={homeLabel} activeOptions={{ exact: true }}>
              <Inbox aria-hidden="true" />
              {pendingInvites > 0 && (
                <Badge variant="count" pinned aria-hidden="true" className="absolute -right-1 -bottom-1">
                  {pendingInvites}
                </Badge>
              )}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <SidebarSeparator className="mx-auto my-2 w-6" />

      <SidebarMenu className="items-center gap-2">
        {rooms.map((room) => (
          <SidebarMenuItem key={room.id}>
            <SidebarMenuButton
              asChild
              size="rail"
              indicator="pill"
              isActive={room.id === roomId}
              tooltip={railTooltip(room.name)}
            >
              <Link to="/rooms/$roomId" params={{ roomId: room.id }} aria-label={room.name}>
                <RoomIcon emoji={room.emoji} size="sm" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}

        <SidebarMenuItem>
          <CreateRoomDialog>
            <SidebarMenuButton
              type="button"
              size="rail"
              variant="primary"
              aria-label="Create a room"
              tooltip={railTooltip('Create a room')}
            >
              <Plus aria-hidden="true" />
            </SidebarMenuButton>
          </CreateRoomDialog>
        </SidebarMenuItem>
      </SidebarMenu>
    </nav>
  )
}
