import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useRef, type RefObject } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenuAction } from '@/components/ui/sidebar'
import type { Channel } from '@/features/rooms'

interface ChannelActionsMenuProps {
  channel: Channel
  /** The … button; Rename/Delete (from here or the context menu) return focus to it. */
  triggerRef: RefObject<HTMLButtonElement>
  /** Open Rename / Delete, returning focus to `returnFocus` when they close. */
  onRename: (returnFocus: HTMLElement | null) => void
  onDelete: (returnFocus: HTMLElement | null) => void
  /** Undefined at the top / bottom (the item is disabled). */
  onMoveUp?: () => void
  onMoveDown?: () => void
}

/**
 * "Channel options for #name" (…) menu on a sidebar channel row: Rename, Move up, Move down,
 * Delete. Shown on row hover or focus on desktop, always below md (SidebarMenuAction
 * `showOnHover`).
 */
export function ChannelActionsMenu({
  channel,
  triggerRef,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
}: ChannelActionsMenuProps) {
  // Rename/Delete open after the menu has closed (and restored focus), so focus scopes don't fight.
  const requested = useRef<'rename' | 'delete' | null>(null)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction
          ref={triggerRef}
          type="button"
          showOnHover
          aria-label={`Channel options for #${channel.name}`}
        >
          <MoreHorizontal aria-hidden="true" />
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="start"
        className="w-44"
        onCloseAutoFocus={(event) => {
          const action = requested.current
          if (!action) return
          requested.current = null
          event.preventDefault()
          if (action === 'rename') onRename(triggerRef.current)
          else onDelete(triggerRef.current)
        }}
      >
        <DropdownMenuItem
          onSelect={() => {
            requested.current = 'rename'
          }}
        >
          <Pencil aria-hidden="true" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!onMoveUp} onSelect={() => onMoveUp?.()}>
          <ArrowUp aria-hidden="true" />
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!onMoveDown} onSelect={() => onMoveDown?.()}>
          <ArrowDown aria-hidden="true" />
          Move down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            requested.current = 'delete'
          }}
        >
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
