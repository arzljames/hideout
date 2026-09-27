import type { ReactNode } from 'react'
import { RoomIcon } from '@/components/room-icon'
import { Card, CardContent } from '@/components/ui/card'
import { UserAvatar } from '@/components/user-avatar'
import { cn } from '@/lib/utils'
import type { InvitePreview } from '../types'

interface InviteCardProps {
  preview: InvitePreview
  /** Join or sign-in controls, below the room details. */
  children?: ReactNode
  className?: string
}

/** A link invite's room, member count and inviter, with the caller's actions below. */
export function InviteCard({ preview, children, className }: InviteCardProps) {
  const { room, memberCount, invitedBy } = preview

  return (
    <Card className={cn('[--card-spacing:--spacing(8)]', className)}>
      <CardContent className="flex flex-col items-center text-center">
        <RoomIcon icon={room.icon} name={room.name} />

        <p className="mt-5 flex items-center gap-1.5 text-sm text-muted-foreground">
          {invitedBy ? (
            <>
              <UserAvatar name={invitedBy.displayName} src={invitedBy.avatarUrl} size="sm" />
              <span>
                <bdi className="font-semibold text-foreground">{invitedBy.displayName}</bdi>{' '}
                invited you to join
              </span>
            </>
          ) : (
            <span>You&apos;re invited to join</span>
          )}
        </p>

        <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight">
          <bdi>{room.name}</bdi>
        </h1>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden="true" className="size-2 rounded-full border border-muted-foreground" />
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </p>

        <div className="mt-6 flex w-full flex-col gap-3">{children}</div>
      </CardContent>
    </Card>
  )
}
