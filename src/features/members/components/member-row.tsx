import { useRef } from 'react'
import { SidebarMenuItem } from '@/components/ui/sidebar'
import { UserAvatar } from '@/components/user-avatar'
import type { Member } from '@/features/rooms'
import { cn } from '@/lib/utils'
import type { MemberMenuAction, MemberMenuEntry } from '../member-menu-entries'
import { MemberActionsMenu } from './member-actions-menu'
import { MemberContextMenu } from './member-context-menu'

interface MemberRowProps {
  member: Member
  isViewer: boolean
  /** What the viewer may do to this member; empty means no menus at all. */
  entries: MemberMenuEntry[]
  onAction: (action: MemberMenuAction, returnFocus: HTMLElement | null) => void
  busy?: boolean
  className?: string
}

/**
 * One member in the member list: avatar and name, plus (when the viewer can act on them) a …
 * menu and a context menu with the same items. TODO(presence): online state.
 */
export function MemberRow({ member, isViewer, entries, onAction, busy, className }: MemberRowProps) {
  const actionsRef = useRef<HTMLButtonElement>(null)
  const { displayName, avatarUrl } = member.user
  const hasActions = entries.length > 0

  const content = (
    <div className={cn('flex items-center gap-2.5 rounded-md px-2 py-1.5', hasActions && 'pr-8')}>
      <UserAvatar name={displayName} src={avatarUrl} />
      <p className="flex min-w-0 flex-1 items-center gap-1.5">
        <bdi className="truncate text-sm font-medium text-foreground">{displayName}</bdi>
        {isViewer && <span className="shrink-0 text-xs text-muted-foreground">(you)</span>}
      </p>
    </div>
  )

  return (
    <SidebarMenuItem className={cn(className)}>
      {hasActions ? (
        <>
          <MemberContextMenu
            entries={entries}
            getReturnFocus={() => actionsRef.current}
            onAction={onAction}
            busy={busy}
          >
            {content}
          </MemberContextMenu>
          <MemberActionsMenu
            memberName={displayName}
            entries={entries}
            triggerRef={actionsRef}
            onAction={onAction}
            busy={busy}
          />
        </>
      ) : (
        content
      )}
    </SidebarMenuItem>
  )
}
