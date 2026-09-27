import type { RoomDetail } from '@/features/rooms'
import type { MemberActionRequest } from '../hooks/use-member-actions'
import { RemoveMemberDialog } from './remove-member-dialog'
import { TransferOwnershipDialog } from './transfer-ownership-dialog'

interface MemberActionDialogsProps {
  room: RoomDetail
  request: MemberActionRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Where focus goes when the opener is gone (e.g. the removed member's row). */
  fallbackFocus: () => HTMLElement | null
}

/** The confirmation for a `useMemberActions` request, rendered once per member list. */
export function MemberActionDialogs({
  room,
  request,
  open,
  onOpenChange,
  fallbackFocus,
}: MemberActionDialogsProps) {
  if (!request) return null
  const returnFocus = () =>
    request.returnFocus?.isConnected ? request.returnFocus : fallbackFocus()

  if (request.action === 'remove') {
    return (
      <RemoveMemberDialog
        key={request.key}
        roomId={room.room.id}
        roomName={room.room.name}
        member={request.member}
        open={open}
        onOpenChange={onOpenChange}
        returnFocus={returnFocus}
      />
    )
  }
  // Stays mounted when ownership moves (so a successful transfer closes normally and returns
  // focus); if it moved elsewhere while the dialog sat idle, the dialog closes itself.
  return (
    <TransferOwnershipDialog
      key={request.key}
      roomId={room.room.id}
      roomName={room.room.name}
      member={request.member}
      isOwner={room.myRole === 'owner'}
      open={open}
      onOpenChange={onOpenChange}
      returnFocus={returnFocus}
    />
  )
}
