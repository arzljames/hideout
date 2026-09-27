import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { meQueryOptions } from '@/features/auth'
import { TransferOwnershipControl } from '@/features/members'
import type { RoomDetail } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { DeleteRoomDialog } from './delete-room-dialog'

interface DangerZoneProps {
  room: RoomDetail
  className?: string
}

/**
 * Owner-only "Transfer ownership" and "Delete room" panel. After a transfer you're an admin, so
 * the Overview stops rendering it.
 */
export function DangerZone({ room, className }: DangerZoneProps) {
  const transferTitleId = useId()
  const deleteTitleId = useId()
  const viewerId = useQuery(meQueryOptions).data?.id
  const { id: roomId, name: roomName } = room.room

  return (
    <div className={cn(className)}>
      <Card tone="danger">
        <CardContent className="flex flex-col gap-6">
          <section aria-labelledby={transferTitleId} className="flex flex-col items-start gap-3">
            <h2 id={transferTitleId} className="text-sm font-semibold text-destructive">
              Transfer ownership
            </h2>
            <p className="text-sm text-muted-foreground">
              Make another member the owner. You&apos;ll become an admin and can&apos;t undo this
              yourself.
            </p>
            <TransferOwnershipControl
              roomId={roomId}
              roomName={roomName}
              members={room.members}
              viewerId={viewerId}
            />
          </section>
          <Separator />
          <section aria-labelledby={deleteTitleId} className="flex flex-col items-start gap-3">
            <h2 id={deleteTitleId} className="text-sm font-semibold text-destructive">
              Delete room
            </h2>
            <p className="text-sm text-muted-foreground">
              This deletes every channel and message for everyone. It can&apos;t be undone. Only
              the owner can do this.
            </p>
            <DeleteRoomDialog roomId={roomId} roomName={roomName} />
          </section>
        </CardContent>
      </Card>
    </div>
  )
}
