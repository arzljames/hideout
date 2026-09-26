import { MoreHorizontal, ShieldCheck, ShieldOff, UserMinus } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { RoomMember } from '@/features/rooms'
import { RemoveMemberDialog } from './remove-member-dialog'

interface MemberActionsMenuProps {
  member: RoomMember
  roomName: string
  /** Only the owner can promote or demote admins. */
  canChangeRole: boolean
}

/** "Actions for Maya" menu: Make/Remove admin and Remove from room (with confirmation). */
export function MemberActionsMenu({ member, roomName, canChangeRole }: MemberActionsMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [removeOpen, setRemoveOpen] = useState(false)
  // Open the confirmation after the menu has closed, so the focus scopes don't fight.
  const removeRequested = useRef(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${member.name}`}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48"
          onCloseAutoFocus={(event) => {
            if (removeRequested.current) {
              removeRequested.current = false
              event.preventDefault()
              setRemoveOpen(true)
            }
          }}
        >
          {canChangeRole && (
            <>
              {/* TODO(api): change member role mutation. */}
              {member.role === 'admin' ? (
                <DropdownMenuItem>
                  <ShieldOff aria-hidden="true" />
                  Remove admin
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem>
                  <ShieldCheck aria-hidden="true" />
                  Make admin
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              removeRequested.current = true
            }}
          >
            <UserMinus aria-hidden="true" />
            Remove from room
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RemoveMemberDialog
        memberName={member.name}
        roomName={roomName}
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        returnFocusRef={triggerRef}
      />
    </>
  )
}
