import { useState, type ReactNode } from 'react'
import { ConnectionBanner } from '@/components/connection-banner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { useMemberPanelStore } from '../member-panel-store'
import type { RoomDetail } from '../types'

interface RoomLayoutProps {
  room: RoomDetail
  /** The channel column (header, content, composer). */
  children: ReactNode
  /**
   * The member panel's content for a given className (the members feature's MemberList; rooms
   * can't import it). Rendered inline from `md` up and in the Sheet below.
   */
  renderMembers: (className: string) => ReactNode
  /** Live updates for the room are down (see useRoomEvents): show a banner over the channel. */
  liveUpdatesPaused?: boolean
  className?: string
}

/**
 * Room page body: the channel column plus the member panel, inline from `md` up and a
 * right-hand Sheet below. The Sheet root wraps the whole room so MemberPanelToggle (in the
 * channel header) can be its real trigger.
 */
export function RoomLayout({
  room,
  children,
  renderMembers,
  liveUpdatesPaused,
  className,
}: RoomLayoutProps) {
  const { isMobile } = useSidebar()
  const panelOpen = useMemberPanelStore((s) => s.open)
  const [sheetOpen, setSheetOpen] = useState(false)
  // Close the sheet when the viewport grows past `md`, so it doesn't reappear on the way back.
  const [wasMobile, setWasMobile] = useState(isMobile)
  if (wasMobile !== isMobile) {
    setWasMobile(isMobile)
    if (!isMobile) setSheetOpen(false)
  }

  return (
    <Sheet open={isMobile && sheetOpen} onOpenChange={setSheetOpen}>
      <div className={cn('flex h-svh min-h-0', className)}>
        <div className="flex min-w-0 flex-1 flex-col">
          {liveUpdatesPaused && (
            <ConnectionBanner
              title="Live updates paused, retrying…"
              description="Changes to this room may not show until the connection is back."
              className="m-2 w-auto shrink-0"
            />
          )}
          {children}
        </div>
        {!isMobile && panelOpen && renderMembers('w-60 shrink-0 border-l border-sidebar-border')}
      </div>

      {isMobile && (
        <SheetContent side="right" className="w-72 gap-0 bg-sidebar p-0">
          <SheetHeader className="border-b border-sidebar-border">
            <SheetTitle>Members</SheetTitle>
            <SheetDescription className="sr-only">People in {room.room.name}</SheetDescription>
          </SheetHeader>
          {renderMembers('flex-1')}
        </SheetContent>
      )}
    </Sheet>
  )
}
