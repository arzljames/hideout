import type { CSSProperties, ReactNode } from 'react'
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { sampleViewer } from '../sample-viewer'
import { NavPanel } from './nav-panel'
import { RoomRail } from './room-rail'

interface AppShellProps {
  children: ReactNode
  className?: string
}

/** Rail (3.5rem) + nav panel (14rem). Below `md` the sheet uses the sidebar's mobile width. */
const shellStyle = { '--sidebar-width': '17.5rem' } as CSSProperties

/**
 * Authenticated app layout: room rail and nav panel inside the shadcn Sidebar (an off-canvas
 * Sheet below `md`), page content in SidebarInset, which is the page's only `main` landmark.
 */
export function AppShell({ children, className }: AppShellProps) {
  // TODO(api): read the viewer from meQueryOptions (useSuspenseQuery) instead of sample data.
  const viewer = sampleViewer

  return (
    <TooltipProvider>
      <SidebarProvider style={shellStyle} className={className}>
        <Sidebar mobileTitle="Navigation" mobileDescription="Rooms, invites and your account.">
          <div className="flex h-full min-h-0">
            <RoomRail />
            <NavPanel viewer={viewer} />
          </div>
        </Sidebar>
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
