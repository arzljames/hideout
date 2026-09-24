import type { ReactNode } from 'react'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  /** Page title, rendered as the page's only h1. */
  title: string
  /** Decorative icon before the title (e.g. a channel's # or speaker); give it `aria-hidden`. */
  icon?: ReactNode
  /** Short muted text after the title (e.g. a channel topic). Hidden below `sm`. */
  description?: ReactNode
  /** Optional trailing actions. */
  actions?: ReactNode
  className?: string
}

/**
 * Header bar at the top of the main area. The navigation trigger shows below `md` (opens the
 * sheet) and on desktop while the sidebar is collapsed (e.g. via Ctrl/Cmd+B), so there's
 * always a visible way back.
 */
export function AppHeader({ title, icon, description, actions, className }: AppHeaderProps) {
  const { state } = useSidebar()

  return (
    <header
      className={cn('flex h-12 shrink-0 items-center gap-2 border-b border-border px-4', className)}
    >
      <SidebarTrigger
        className={cn('-ml-1', state === 'expanded' && 'md:hidden')}
        aria-label="Open navigation"
      />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {icon && (
          <span className="flex shrink-0 text-muted-foreground [&_svg]:size-4">{icon}</span>
        )}
        <h1 className="min-w-0 truncate text-sm font-semibold">{title}</h1>
        {description && (
          <>
            <span aria-hidden="true" className="hidden h-4 w-px shrink-0 bg-border sm:block" />
            <p className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block">
              {description}
            </p>
          </>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  )
}
