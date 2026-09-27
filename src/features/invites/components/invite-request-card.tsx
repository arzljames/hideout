import { useId, type Ref } from 'react'
import { RoomIcon } from '@/components/room-icon'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { UserAvatar } from '@/components/user-avatar'
import { cn } from '@/lib/utils'
import type { InboxInvite } from '../types'

interface InviteRequestCardProps {
  invite: InboxInvite
  onAccept: (invite: InboxInvite) => void
  onDecline: (invite: InboxInvite) => void
  /** Lets the inbox move focus to this card's Accept button after a neighbour is removed. */
  acceptRef?: Ref<HTMLButtonElement>
  className?: string
}

/** One pending direct invite: room, who invited you, Decline and Accept. */
export function InviteRequestCard({
  invite,
  onAccept,
  onDecline,
  acceptRef,
  className,
}: InviteRequestCardProps) {
  const nameId = useId()
  const { room, invitedBy } = invite

  return (
    <article aria-labelledby={nameId} className={cn(className)}>
      <Card>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <RoomIcon icon={room.icon} name={room.name} size="md" />
            <div className="min-w-0">
              <h2 id={nameId} className="truncate text-sm font-semibold">
                <bdi>{room.name}</bdi>
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <UserAvatar name={invitedBy.displayName} src={invitedBy.avatarUrl} size="sm" />
                <span className="truncate">
                  <bdi>{invitedBy.displayName}</bdi> invited you
                </span>
              </p>
            </div>
          </div>

          {/* Visible "Decline"/"Accept"; the aria-labels add the room so each is unique. */}
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="secondary"
              aria-label={`Decline invite to ${room.name}`}
              onClick={() => onDecline(invite)}
              className="flex-1 md:flex-none"
            >
              Decline
            </Button>
            <Button
              ref={acceptRef}
              type="button"
              aria-label={`Accept invite to ${room.name}`}
              onClick={() => onAccept(invite)}
              className="flex-1 md:flex-none"
            >
              Accept
            </Button>
          </div>
        </CardContent>
      </Card>
    </article>
  )
}
