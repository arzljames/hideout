import { useId } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { DeleteRoomDialog } from './delete-room-dialog'

interface DangerZoneProps {
  roomId: string
  roomName: string
  className?: string
}

/** Owner-only "Delete room" panel. */
export function DangerZone({ roomId, roomName, className }: DangerZoneProps) {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className={cn(className)}>
      <Card tone="danger">
        <CardContent className="flex flex-col items-start gap-3">
          <h2 id={titleId} className="text-sm font-semibold text-destructive">
            Delete room
          </h2>
          <p className="text-sm text-muted-foreground">
            This deletes every channel and message for everyone. It can&apos;t be undone. Only the
            owner can do this.
          </p>
          <DeleteRoomDialog roomId={roomId} roomName={roomName} />
        </CardContent>
      </Card>
    </section>
  )
}
