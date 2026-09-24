import { Inbox, Plus } from 'lucide-react'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { CreateRoomDialog } from '@/features/rooms'
import { cn } from '@/lib/utils'

interface RoomRailProps {
  className?: string
}

/** Narrow far-left column: Home, the user's rooms (later), and Create a room. */
export function RoomRail({ className }: RoomRailProps) {
  // Rail buttons are icon-only, so show their tooltips on desktop even while expanded. Drop
  // them in the mobile sheet: focus lands on Home when it opens, and an open tooltip would
  // swallow the first Esc. (`hidden: true` isn't enough; the tooltip still opens and
  // handles Esc, it just isn't displayed.)
  const { isMobile } = useSidebar()
  const railTooltip = (label: string) => (isMobile ? undefined : { children: label, hidden: false })

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
          {/* TODO(routes): make this a typed <Link to="/"> via asChild; the router then sets aria-current. */}
          <SidebarMenuButton
            type="button"
            size="rail"
            isActive
            aria-current="page"
            aria-label="Home"
            tooltip={railTooltip('Home')}
          >
            <Inbox aria-hidden="true" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <SidebarSeparator className="mx-auto my-2 w-6" />

      {/* TODO(rooms): list the user's rooms here (RoomIcon tiles) from the rooms query. */}

      <SidebarMenu className="items-center">
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
