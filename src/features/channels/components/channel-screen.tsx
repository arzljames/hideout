import { getRoomChannel, getSampleRoom } from '@/features/rooms'
import { ChannelNotFound } from './channel-not-found'
import { TextChannelView } from './text-channel-view'
import { VoiceChannelView } from './voice-channel-view'

interface ChannelScreenProps {
  roomId: string
  channelId: string
}

/** Picks the text or voice view for a channel. The route loader has already 404'd unknowns. */
export function ChannelScreen({ roomId, channelId }: ChannelScreenProps) {
  // TODO(api): useSuspenseQuery(roomQueryOptions(roomId)).
  const room = getSampleRoom(roomId)
  const channel = room && getRoomChannel(room, channelId)
  if (!room) return null
  if (!channel) {
    return (
      <ChannelNotFound
        roomId={room.id}
        roomName={room.name}
        defaultChannelId={room.defaultChannelId}
      />
    )
  }

  return channel.kind === 'text' ? (
    <TextChannelView key={channel.id} room={room} channel={channel} />
  ) : (
    <VoiceChannelView key={channel.id} room={room} channel={channel} />
  )
}
