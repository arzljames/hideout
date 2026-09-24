import { RoomIcon } from '@/components/room-icon'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { UserAvatar } from '@/components/user-avatar'
import { cn } from '@/lib/utils'
import type { InvitePreview } from '../sample-invite'

interface InviteCardProps {
  invite: InvitePreview
  className?: string
}

export function InviteCard({ invite, className }: InviteCardProps) {
  const { inviter, room, landingChannel } = invite
  const memberLabel = room.memberCount === 1 ? 'member' : 'members'

  return (
    <Card className={cn('[--card-spacing:--spacing(8)]', className)}>
      <CardContent className="flex flex-col items-center text-center">
        <RoomIcon emoji={room.emoji} />

        <p className="mt-5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <UserAvatar name={inviter.name} tone={inviter.tone} size="sm" />
          <span>
            <span className="font-semibold text-foreground">{inviter.name}</span> invited you to
            join
          </span>
        </p>

        <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight">{room.name}</h1>

        <ul role="list" className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full bg-presence-online" />
            {room.onlineCount} online
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full border border-muted-foreground" />
            {room.memberCount} {memberLabel}
          </li>
        </ul>

        {/* TODO(api): accept invite, then navigate to the landing channel */}
        <Button type="button" size="lg" className="mt-6 w-full">
          Join room
        </Button>

        <p className="mt-3 text-xs text-muted-foreground">
          You&apos;ll land in <span className="font-medium text-foreground">#{landingChannel}</span>.
        </p>
      </CardContent>
    </Card>
  )
}
