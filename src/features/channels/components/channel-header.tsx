import { Hash, UserPlus, Volume2 } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { Button } from '@/components/ui/button'
import { InviteDialog, MemberPanelToggle, type Channel, type RoomDetail } from '@/features/rooms'
import { cn } from '@/lib/utils'

interface ChannelHeaderProps {
  room: RoomDetail
  channel: Channel
  className?: string
}

/** Channel title bar: name (h1), Invite and the member panel toggle. */
export function ChannelHeader({ room, channel, className }: ChannelHeaderProps) {
  return (
    <AppHeader
      className={cn(className)}
      title={channel.name}
      icon={channel.type === 'text' ? <Hash aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
      actions={
        <>
          <InviteDialog roomName={room.room.name}>
            <Button type="button" variant="outline" size="sm">
              <UserPlus aria-hidden="true" />
              Invite
            </Button>
          </InviteDialog>
          <MemberPanelToggle />
        </>
      }
    />
  )
}
