import { Link as LinkIcon, Plus } from 'lucide-react'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import { InviteDialog, type Room } from '@/features/rooms'
import { cn } from '@/lib/utils'
import type { RoomInviteLink } from '../sample-invite-links'
import { InviteLinkRow } from './invite-link-row'
import { SettingsSectionHeader } from './settings-section-header'

interface InvitesSectionProps {
  room: Room
  /** Loaded separately from the room: invite codes are credentials (owner/admin only). */
  inviteLinks: RoomInviteLink[]
  className?: string
}

/** Active invite links, with Create and Revoke. */
export function InvitesSection({ room, inviteLinks: links, className }: InvitesSectionProps) {

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <SettingsSectionHeader
        title="Invites"
        description="Anyone with an active link can join. Revoke a link to stop it working."
        actions={
          // The trigger is the dialog's DialogTrigger, so Radix returns focus to it.
          <InviteDialog roomName={room.name}>
            <Button type="button">
              <Plus aria-hidden="true" />
              Create invite link
            </Button>
          </InviteDialog>
        }
      />

      {links.length > 0 ? (
        <ul role="list" aria-label="Active invite links" className="divide-y divide-border">
          {links.map((invite) => (
            <InviteLinkRow key={invite.code} invite={invite} />
          ))}
        </ul>
      ) : (
        <CenteredState
          tone="muted"
          icon={<LinkIcon aria-hidden="true" />}
          title="No active invite links"
          description="Create one to let your squad in."
        />
      )}
    </div>
  )
}
