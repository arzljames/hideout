import { useQuery } from '@tanstack/react-query'
import { Link as LinkIcon, Plus, RotateCw, TriangleAlert } from 'lucide-react'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { InviteDialog, roomInvitesQueryOptions } from '@/features/invites'
import type { RoomDetail } from '@/features/rooms'
import { ApiError } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { InviteLinkRow } from './invite-link-row'
import { SettingsSectionHeader } from './settings-section-header'

interface InvitesSectionProps {
  room: RoomDetail
  className?: string
}

/**
 * The room's active invites (links and direct), with Create and Revoke. Loaded here rather than
 * in the route: a failed list shouldn't take down the other settings sections.
 */
export function InvitesSection({ room, className }: InvitesSectionProps) {
  const { id: roomId, name: roomName } = room.room
  const invites = useQuery(roomInvitesQueryOptions(roomId))
  const offline = invites.error instanceof ApiError && invites.error.code === 'NETWORK'

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <SettingsSectionHeader
        title="Invites"
        description="Active invite links and Steam invites. Revoke one to stop it working."
        actions={
          // The trigger is the dialog's DialogTrigger, so Radix returns focus to it.
          <InviteDialog roomId={roomId} roomName={roomName} myRole={room.myRole}>
            <Button type="button">
              <Plus aria-hidden="true" />
              Create invite
            </Button>
          </InviteDialog>
        }
      />

      {invites.isPending ? (
        <div aria-busy="true" aria-label="Loading invites" className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !invites.data ? (
        <CenteredState
          role="alert"
          tone="destructive"
          icon={<TriangleAlert aria-hidden="true" />}
          title={offline ? "Couldn't reach Hideout" : "Invites didn't load"}
          description={
            offline ? 'Check your connection and try again.' : 'Something went wrong. Try again.'
          }
          actions={
            <Button
              type="button"
              disabled={invites.isFetching}
              onClick={() => void invites.refetch()}
            >
              <RotateCw aria-hidden="true" />
              Try again
            </Button>
          }
        />
      ) : invites.data.length > 0 ? (
        <ul role="list" aria-label="Active invites" className="divide-y divide-border">
          {invites.data.map((invite) => (
            <InviteLinkRow key={invite.id} roomId={roomId} invite={invite} />
          ))}
        </ul>
      ) : (
        <CenteredState
          tone="muted"
          icon={<LinkIcon aria-hidden="true" />}
          title="No active invites"
          description="Create one to let your squad in."
        />
      )}
    </div>
  )
}
