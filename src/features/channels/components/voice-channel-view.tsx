import { PhoneCall, Volume2 } from 'lucide-react'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import type { Channel, RoomDetail } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { ChannelHeader } from './channel-header'

interface VoiceChannelViewProps {
  room: RoomDetail
  channel: Channel
  className?: string
}

/**
 * A voice channel. TODO(livekit): participant tiles (ParticipantTile) and the Join bar
 * (JoinVoiceBar) from the voice session (voice-realtime-engineer); until then it's empty.
 */
export function VoiceChannelView({ room, channel, className }: VoiceChannelViewProps) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <ChannelHeader room={room} channel={channel} />
      <CenteredState
        icon={<Volume2 aria-hidden="true" />}
        title="No one's in voice"
        description={`Join ${channel.name} and anyone in ${room.room.name} can hop in with you.`}
        actions={
          // TODO(livekit): request a voice token and connect (voice-realtime-engineer).
          <Button type="button">
            <PhoneCall aria-hidden="true" />
            Join voice
          </Button>
        }
      />
    </div>
  )
}
