import { Hash, UserPlus, Volume2 } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { Button } from '@/components/ui/button'
import { InviteDialog, MemberPanelToggle, type Channel, type Room } from '@/features/rooms'
import { cn } from '@/lib/utils'

interface ChannelHeaderProps {
  room: Room
  channel: Channel
  /** Voice channels: how many people are shown in the channel (from useVoiceParticipants). */
  voiceCount?: number
  className?: string
}

/** Channel title bar: name (h1), topic or voice count, Invite and the member panel toggle. */
export function ChannelHeader({ room, channel, voiceCount, className }: ChannelHeaderProps) {
  const description =
    channel.kind === 'text'
      ? channel.topic
      : `${voiceCount ?? channel.participants.length} in voice`

  return (
    <AppHeader
      className={cn(className)}
      title={channel.name}
      icon={
        channel.kind === 'text' ? <Hash aria-hidden="true" /> : <Volume2 aria-hidden="true" />
      }
      description={description}
      actions={
        <>
          <InviteDialog roomName={room.name}>
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
