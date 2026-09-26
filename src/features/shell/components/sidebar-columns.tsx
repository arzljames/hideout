import type { MouseEvent } from 'react'
import { useSidebar } from '@/components/ui/sidebar'
import type { Me } from '@/features/auth'
import { cn } from '@/lib/utils'
import { NavPanel } from './nav-panel'
import { RoomRail } from './room-rail'

interface SidebarColumnsProps {
  user: Me | null | undefined
  className?: string
}

/**
 * Rail + nav panel side by side. In the mobile sheet, following any link (room tile, channel,
 * Home) closes the sheet so the new page isn't left covered by the overlay.
 */
export function SidebarColumns({ user, className }: SidebarColumnsProps) {
  const { isMobile, setOpenMobile } = useSidebar()

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (isMobile && event.target instanceof Element && event.target.closest('a[href]')) {
      setOpenMobile(false)
    }
  }

  return (
    // Delegated click handler only; the links inside stay the interactive elements.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className={cn('flex h-full min-h-0', className)} onClick={handleClick}>
      <RoomRail />
      <NavPanel user={user} />
    </div>
  )
}
