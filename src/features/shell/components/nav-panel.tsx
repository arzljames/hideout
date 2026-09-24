import { Inbox } from 'lucide-react'
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import type { ShellViewer } from '../sample-viewer'
import { UserCard } from './user-card'

interface NavPanelProps {
  viewer: ShellViewer
  className?: string
}

/** Second sidebar column: context header, section links, and the user card. */
export function NavPanel({ viewer, className }: NavPanelProps) {
  return (
    <div className={cn('flex min-w-0 flex-1 flex-col bg-sidebar', className)}>
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

      <SidebarFooter className="border-t border-sidebar-border">
        <UserCard user={viewer} />
      </SidebarFooter>
    </div>
  )
}
