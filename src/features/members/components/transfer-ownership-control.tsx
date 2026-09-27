import { Crown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { sameRoomId, type Member } from '@/features/rooms'
import { TransferOwnershipDialog } from './transfer-ownership-dialog'

interface TransferOwnershipControlProps {
  roomId: string
  roomName: string
  members: Member[]
  /** The signed-in user (left out of the choices). */
  viewerId: string | undefined
  className?: string
}

/**
 * "Transfer ownership" button (Danger zone) opening a confirmation with a Select of the other
 * members. Disabled when you're the only member.
 */
export function TransferOwnershipControl({
  roomId,
  roomName,
  members,
  viewerId,
  className,
}: TransferOwnershipControlProps) {
  const [open, setOpen] = useState(false)
  const [openCount, setOpenCount] = useState(0)
  // Until we know who "you" are, offer nobody (the button stays disabled).
  const candidates =
    viewerId === undefined
      ? []
      : members.filter((member) => !sameRoomId(member.user.id, viewerId))

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={candidates.length === 0}
        onClick={() => {
          setOpenCount((count) => count + 1)
          setOpen(true)
        }}
        className={className}
      >
        <Crown aria-hidden="true" />
        Transfer ownership
      </Button>
      <TransferOwnershipDialog
        key={openCount}
        roomId={roomId}
        roomName={roomName}
        candidates={candidates}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
