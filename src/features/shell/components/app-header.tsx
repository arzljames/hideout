import type { ReactNode } from 'react'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  /** Page title, rendered as the page's only h1. */
  title: string
  /** Optional trailing actions. */
  actions?: ReactNode
  className?: string
}

/**
 * Header bar at the top of the main area. The navigation trigger shows below `md` (opens the
 * sheet) and on desktop while the sidebar is collapsed (e.g. via Ctrl/Cmd+B), so there's
 * always a visible way back.
 */
export function AppHeader({ title, actions, className }: AppHeaderProps) {
  const { state } = useSidebar()

  return (
    <header
      className={cn('flex h-12 shrink-0 items-center gap-2 border-b border-border px-4', className)}
    >
      <SidebarTrigger
        className={cn('-ml-1', state === 'expanded' && 'md:hidden')}
        aria-label="Open navigation"
      />
      <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h1>
      {actions}
    </header>
  )
}
