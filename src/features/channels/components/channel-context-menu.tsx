import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

interface ChannelContextMenuProps {
  /** The row's link, rendered via `ContextMenuTrigger asChild`. Must forward its ref. */
  children: ReactNode
  /** Where focus goes when Rename/Delete close (the row's … button), resolved when opening. */
  getReturnFocus: () => HTMLElement | null
  onRename: (returnFocus: HTMLElement | null) => void
  onDelete: (returnFocus: HTMLElement | null) => void
  /** Undefined at the top / bottom (the item is disabled). */
  onMoveUp?: () => void
  onMoveDown?: () => void
}

/** Right-click (or long-press) menu on a channel row, with the same items as its … menu. */
export function ChannelContextMenu({
  children,
  getReturnFocus,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
}: ChannelContextMenuProps) {
  // Rename/Delete open after the menu has closed, so focus scopes don't fight.
  const requested = useRef<'rename' | 'delete' | null>(null)

  return (
    <ContextMenu>
      {/* No iOS link preview on long-press: it would fight the context menu. */}
      <ContextMenuTrigger asChild className="[-webkit-touch-callout:none]">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        className="w-44"
        onCloseAutoFocus={(event) => {
          const action = requested.current
          if (!action) return
          requested.current = null
          event.preventDefault()
          if (action === 'rename') onRename(getReturnFocus())
          else onDelete(getReturnFocus())
        }}
      >
        <ContextMenuItem
          onSelect={() => {
            requested.current = 'rename'
          }}
        >
          <Pencil aria-hidden="true" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem disabled={!onMoveUp} onSelect={() => onMoveUp?.()}>
          <ArrowUp aria-hidden="true" />
          Move up
        </ContextMenuItem>
        <ContextMenuItem disabled={!onMoveDown} onSelect={() => onMoveDown?.()}>
          <ArrowDown aria-hidden="true" />
          Move down
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onSelect={() => {
            requested.current = 'delete'
          }}
        >
          <Trash2 aria-hidden="true" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
