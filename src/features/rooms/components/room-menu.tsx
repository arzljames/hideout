import { Link } from '@tanstack/react-router'
import { ChevronDown, LogOut, Settings, UserPlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { getViewerRole, type Room } from '../sample-room'
import { InviteDialog } from './invite-dialog'

interface RoomMenuProps {
  room: Room
  className?: string
}

/** Room name button in the channel panel header, opening room actions. */
export function RoomMenu({ room, className }: RoomMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  // "Invite people" waits for the menu to finish closing (and restoring focus) before the
  // dialog opens, so the two focus scopes don't fight.
  const inviteRequested = useRef(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            variant="ghost"
            className={cn('w-full justify-between', className)}
          >
            <span className="truncate font-semibold">{room.name}</span>
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-56"
          onCloseAutoFocus={(event) => {
            if (inviteRequested.current) {
              inviteRequested.current = false
              event.preventDefault()
              setInviteOpen(true)
            }
          }}
        >
          <DropdownMenuItem
            onSelect={() => {
              inviteRequested.current = true
            }}
          >
            <UserPlus aria-hidden="true" />
            Invite people
          </DropdownMenuItem>
          {/* Only the owner and admins can change settings; members don't see the item. */}
          {/* UI-only gate; hideout-api must enforce the role on every settings mutation. */}
          {getViewerRole(room) !== 'member' && (
            <DropdownMenuItem asChild>
              <Link to="/rooms/$roomId/settings" params={{ roomId: room.id }}>
                <Settings aria-hidden="true" />
                Room settings
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {/* TODO(rooms): confirm with an AlertDialog, then leave via the API. */}
          <DropdownMenuItem variant="destructive">
            <LogOut aria-hidden="true" />
            Leave room
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <InviteDialog
        roomName={room.name}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        returnFocusRef={triggerRef}
      />
    </>
  )
}
