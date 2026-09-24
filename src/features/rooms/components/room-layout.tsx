import { useState, type ReactNode } from 'react'
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
import type { Room } from '../sample-room'
import { MemberList } from './member-list'

interface RoomLayoutProps {
  room: Room
  /** The channel column (header, content, composer). */
  children: ReactNode
  className?: string
}

/**
 * Room page body: the channel column plus the member panel, inline from `md` up and a
 * right-hand Sheet below. The Sheet root wraps the whole room so MemberPanelToggle (in the
 * channel header) can be its real trigger.
 */
export function RoomLayout({ room, children, className }: RoomLayoutProps) {
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
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        {!isMobile && panelOpen && (
          <MemberList room={room} className="w-60 shrink-0 border-l border-sidebar-border" />
        )}
      </div>

      {isMobile && (
        <SheetContent side="right" className="w-72 gap-0 bg-sidebar p-0">
          <SheetHeader className="border-b border-sidebar-border">
            <SheetTitle>Members</SheetTitle>
            <SheetDescription className="sr-only">People in {room.name}</SheetDescription>
          </SheetHeader>
          <MemberList room={room} className="flex-1" />
        </SheetContent>
      )}
    </Sheet>
  )
}
