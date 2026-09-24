import { Inbox } from 'lucide-react'
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

/** Nav panel content on Home: header and the Home sections. NavPanel adds the footer. */
export function HomePanel() {
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
                  {/* TODO(routes): make this a typed <Link to="/invites"> via asChild once the route exists. */}
                  <SidebarMenuButton type="button">
                    <Inbox aria-hidden="true" />
                    <span>Invites</span>
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
