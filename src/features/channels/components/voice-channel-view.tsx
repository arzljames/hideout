import { PhoneCall, Volume2 } from 'lucide-react'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useVoiceParticipants, type Room, type VoiceChannel } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { ChannelHeader } from './channel-header'
import { JoinVoiceBar } from './join-voice-bar'
import { ParticipantTile } from './participant-tile'

interface VoiceChannelViewProps {
  room: Room
  channel: VoiceChannel
  className?: string
}

/**
 * A voice channel: participant tiles (with a Join bar when you're not connected here), or an
 * empty state with Join voice. Your own tile shows only while you're connected to this channel.
 */
export function VoiceChannelView({ room, channel, className }: VoiceChannelViewProps) {
  const { participants, viewerConnected } = useVoiceParticipants(room, channel)

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <ChannelHeader room={room} channel={channel} voiceCount={participants.length} />
      {participants.length > 0 ? (
        <>
          {!viewerConnected && <JoinVoiceBar count={participants.length} />}
          <ScrollArea className="min-h-0 flex-1">
            <ul
              role="list"
              aria-label="Participants"
              className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {participants.map(({ member, muted, deafened, speaking }) => (
                <li key={member.id}>
                  <ParticipantTile
                    member={member}
                    muted={muted}
                    deafened={deafened}
                    speaking={speaking}
                  />
                </li>
              ))}
            </ul>
          </ScrollArea>
        </>
      ) : (
        <CenteredState
          icon={<Volume2 aria-hidden="true" />}
          title="No one's here yet"
          description={`Join ${channel.name} and anyone in ${room.name} can hop in with you.`}
          actions={
            // TODO(livekit): request a voice token and connect (voice-realtime-engineer).
            <Button type="button">
              <PhoneCall aria-hidden="true" />
              Join voice
            </Button>
          }
        />
      )}
    </div>
  )
}
