import { useId, type Ref } from 'react'
import { RoomIcon } from '@/components/room-icon'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { UserAvatar } from '@/components/user-avatar'
import { cn } from '@/lib/utils'
import type { PendingInvite } from '../sample-pending-invites'

interface InviteRequestCardProps {
  invite: PendingInvite
  onAccept: (invite: PendingInvite) => void
  onDecline: (invite: PendingInvite) => void
  /** Lets the inbox move focus to this card's Accept button after a neighbour is removed. */
  acceptRef?: Ref<HTMLButtonElement>
  className?: string
}

/** One pending invite: room, who invited you and when, Decline and Accept. */
export function InviteRequestCard({
  invite,
  onAccept,
  onDecline,
  acceptRef,
  className,
}: InviteRequestCardProps) {
  const nameId = useId()
  const { room, inviter } = invite

  return (
    <article aria-labelledby={nameId} className={cn(className)}>
      <Card>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <RoomIcon emoji={room.emoji} size="md" />
            <div className="min-w-0">
              <h2 id={nameId} className="truncate text-sm font-semibold">
                {room.name}
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <UserAvatar name={inviter.name} tone={inviter.tone} size="sm" />
                <span className="truncate">
                  {inviter.name} invited you · {invite.sentLabel}
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
