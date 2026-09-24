import { Link, useMatchRoute } from '@tanstack/react-router'
import { Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { usePendingInviteCount } from '@/features/invites'

/** Nav panel content on Home: header and the Home sections. NavPanel adds the footer. */
export function HomePanel() {
  const matchRoute = useMatchRoute()
  const onInvites = Boolean(matchRoute({ to: '/invites' }))
  const pending = usePendingInviteCount()

  return (
    <>
      <SidebarHeader className="h-12 shrink-0 flex-row items-center border-b border-sidebar-border px-4 py-0">
        <p className="truncate text-sm font-semibold">Home</p>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <nav aria-label="Home sections">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={onInvites}>
                    <Link to="/invites">
                      <Inbox aria-hidden="true" />
                      <span>Invites</span>
                      {/* A Badge inside the Link (not SidebarMenuBadge, a sibling): the count is part
                          of the link's accessible name, "Invites 3 pending". The space keeps
                          the words apart in that name. */}
                      {pending > 0 && ' '}
                      {pending > 0 && (
                        <Badge variant="count" className="ml-auto">
                          {pending}{' '}
                          <span className="sr-only">pending</span>
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  )
}
