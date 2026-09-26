import { useQuery } from '@tanstack/react-query'
import type { CSSProperties, ReactNode } from 'react'
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { meQueryOptions } from '@/features/auth'
import { SidebarColumns } from './sidebar-columns'

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
  // useQuery, not useSuspenseQuery: the error and not-found screens render this shell too,
  // including when the session request itself failed, so it must not suspend or throw.
  // Under the `_app` guard the data is already cached, so this reads synchronously.
  const me = useQuery(meQueryOptions)
  const user = me.data ?? (me.isPending ? undefined : null)

  return (
    <TooltipProvider>
      <SidebarProvider style={shellStyle} className={className}>
        <Sidebar mobileTitle="Navigation" mobileDescription="Rooms, invites and your account.">
          <SidebarColumns user={user} />
        </Sidebar>
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
