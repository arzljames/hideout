import { PhoneCall, Volume2 } from 'lucide-react'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { sameRoomId, type Channel, type RoomDetail } from '@/features/rooms'
import { useVoiceSession } from '@/features/voice'
import { cn } from '@/lib/utils'
import { useJoinVoiceChannel, useVoiceChannelPresence } from '../hooks/use-voice-channel'
import { ChannelHeader } from './channel-header'
import { JoinVoiceBar } from './join-voice-bar'
import { ParticipantTile } from './participant-tile'

interface VoiceChannelViewProps {
  room: RoomDetail
  channel: Channel
  className?: string
}

/**
 * A voice channel: a tile per participant (speaking, and your own mute/deafen) under the
 * JoinVoiceBar, or "No one's in voice" with Join when it's empty and you're not joining it.
 */
export function VoiceChannelView({ room, channel, className }: VoiceChannelViewProps) {
  const roomId = room.room.id
  const join = useJoinVoiceChannel(roomId)
  const { participants, viewerId, here, isSpeaking } = useVoiceChannelPresence(roomId, channel.id)
  // Any session state for this channel (joining, in it, or a failed join to retry).
  const mine = useVoiceSession(
    (s) => s.status !== 'idle' && s.channelId !== null && sameRoomId(s.channelId, channel.id),
  )
  const muted = useVoiceSession((s) => s.muted)
  const deafened = useVoiceSession((s) => s.deafened)
  const onJoin = () => void join(channel)

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <ChannelHeader room={room} channel={channel} />
      {(participants.length > 0 || mine) && (
        <JoinVoiceBar channelId={channel.id} count={participants.length} onJoin={onJoin} />
      )}
      {participants.length > 0 ? (
        <ScrollArea className="min-h-0 flex-1">
          <ul
            aria-label="Participants"
            className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3 p-4"
          >
            {participants.map((person) => {
              const isViewer =
                viewerId !== undefined && person.id.toLowerCase() === viewerId.toLowerCase()
              return (
                <li key={person.id}>
                  <ParticipantTile
                    user={person}
                    isViewer={isViewer}
                    speaking={isSpeaking(person.id)}
                    muted={isViewer && here && muted}
                    deafened={isViewer && here && deafened}
                  />
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      ) : (
        <CenteredState
          icon={<Volume2 aria-hidden="true" />}
          title="No one's in voice"
          description={`Join ${channel.name} and anyone in ${room.room.name} can hop in with you.`}
          actions={
            mine ? undefined : (
              <Button type="button" onClick={onJoin}>
                <PhoneCall aria-hidden="true" />
                Join voice
              </Button>
            )
          }
        />
      )}
    </div>
  )
}
