import { GripVertical } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { SidebarMenuAction, SidebarMenuItem } from '@/components/ui/sidebar'
import type { Channel } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { sortableRowVariants } from '../sortable-row-variants'
import { ChannelActionsMenu } from './channel-actions-menu'
import { ChannelContextMenu } from './channel-context-menu'
import type { SortableChannelItem } from './sortable-channel-row'

interface ChannelSidebarRowProps {
  channel: Channel
  /** Present for owners and admins: drag handle, … menu and context menu. */
  item?: SortableChannelItem
  /**
   * The row's SidebarMenuButton link. With `item`, give it `trailingActions="two"` so the name
   * clears the handle and the … button.
   */
  children: ReactNode
  className?: string
}

/**
 * A channel row in the sidebar. Plain members get just the link. Managers also get a drag
 * handle and a … menu (both beside the link, never inside it, so a click on the link only
 * navigates) and a context menu on the link.
 */
export function ChannelSidebarRow({ channel, item, children, className }: ChannelSidebarRowProps) {
  const actionsRef = useRef<HTMLButtonElement>(null)

  if (!item) return <SidebarMenuItem className={cn(className)}>{children}</SidebarMenuItem>
  const { setRowElement, style, isDragging, handleProps, moveUp, moveDown, rename, remove } = item

  return (
    <SidebarMenuItem
      ref={setRowElement}
      style={style}
      data-dragging={isDragging || undefined}
      className={cn(sortableRowVariants({ surface: 'sidebar' }), className)}
    >
      <ChannelContextMenu
        getReturnFocus={() => actionsRef.current}
        onRename={rename}
        onDelete={remove}
        onMoveUp={moveUp}
        onMoveDown={moveDown}
      >
        {children}
      </ChannelContextMenu>
      <SidebarMenuAction position="second" grab showOnHover {...handleProps}>
        <GripVertical aria-hidden="true" />
      </SidebarMenuAction>
      <ChannelActionsMenu
        channel={channel}
        triggerRef={actionsRef}
        onRename={rename}
        onDelete={remove}
        onMoveUp={moveUp}
        onMoveDown={moveDown}
      />
    </SidebarMenuItem>
  )
}
