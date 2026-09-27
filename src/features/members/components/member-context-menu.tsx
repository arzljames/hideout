import { Fragment, useRef, type ReactNode } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { MemberMenuAction, MemberMenuEntry } from '../member-menu-entries'

interface MemberContextMenuProps {
  /** The row's content, rendered via `ContextMenuTrigger asChild`. Must forward its ref. */
  children: ReactNode
  entries: MemberMenuEntry[]
  /** Where focus goes when a confirmation closes (the row's … button), resolved when opening. */
  getReturnFocus: () => HTMLElement | null
  onAction: (action: MemberMenuAction, returnFocus: HTMLElement | null) => void
  busy?: boolean
}

/** Right-click (or long-press) menu on a member row, with the same items as its … menu. */
export function MemberContextMenu({
  children,
  entries,
  getReturnFocus,
  onAction,
  busy = false,
}: MemberContextMenuProps) {
  const requested = useRef<MemberMenuAction | null>(null)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild className="[-webkit-touch-callout:none]">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        className="w-48"
        onCloseAutoFocus={(event) => {
          const action = requested.current
          if (!action) return
          requested.current = null
          event.preventDefault()
          onAction(action, getReturnFocus())
        }}
      >
        {entries.map((entry) => (
          <Fragment key={entry.action}>
            {entry.separated && <ContextMenuSeparator />}
            <ContextMenuItem
              variant={entry.destructive ? 'destructive' : 'default'}
              disabled={busy && (entry.action === 'make-admin' || entry.action === 'remove-admin')}
              onSelect={() => {
                requested.current = entry.action
              }}
            >
              <entry.icon aria-hidden="true" />
              {entry.label}
            </ContextMenuItem>
          </Fragment>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  )
}
