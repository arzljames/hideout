import { MoreHorizontal } from 'lucide-react'
import { Fragment, useRef, type RefObject } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenuAction } from '@/components/ui/sidebar'
import type { MemberMenuAction, MemberMenuEntry } from '../member-menu-entries'

interface MemberActionsMenuProps {
  memberName: string
  entries: MemberMenuEntry[]
  /** The … button; dialogs opened from here or the context menu return focus to it. */
  triggerRef: RefObject<HTMLButtonElement>
  onAction: (action: MemberMenuAction, returnFocus: HTMLElement | null) => void
  /** A role change is in flight: role items are disabled until it (and any refetch) settles. */
  busy?: boolean
}

/**
 * "Member options for {name}" (…) menu on a sidebar member row. Shown on row hover or focus on
 * desktop, always below md (SidebarMenuAction `showOnHover`). Confirmations open after the menu
 * has closed and restored focus, so the focus scopes don't fight.
 */
export function MemberActionsMenu({
  memberName,
  entries,
  triggerRef,
  onAction,
  busy = false,
}: MemberActionsMenuProps) {
  const requested = useRef<MemberMenuAction | null>(null)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction
          ref={triggerRef}
          type="button"
          showOnHover
          aria-label={`Member options for ${memberName}`}
          className="top-1/2 -translate-y-1/2"
        >
          <MoreHorizontal aria-hidden="true" />
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="left"
        align="start"
        className="w-48"
        onCloseAutoFocus={(event) => {
          const action = requested.current
          if (!action) return
          requested.current = null
          event.preventDefault()
          onAction(action, triggerRef.current)
        }}
      >
        {entries.map((entry) => (
          <Fragment key={entry.action}>
            {entry.separated && <DropdownMenuSeparator />}
            <DropdownMenuItem
              variant={entry.destructive ? 'destructive' : 'default'}
              disabled={busy && (entry.action === 'make-admin' || entry.action === 'remove-admin')}
              onSelect={() => {
                requested.current = entry.action
              }}
            >
              <entry.icon aria-hidden="true" />
              {entry.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
