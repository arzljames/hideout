import { useSuspenseQuery } from '@tanstack/react-query'
import { roomQueryOptions } from '@/features/rooms'
import { ChannelNotFound } from './channel-not-found'
import { TextChannelView } from './text-channel-view'
import { VoiceChannelView } from './voice-channel-view'

interface ChannelScreenProps {
  roomId: string
  channelId: string
}

/** Picks the text or voice view for a channel, or "channel not found" for an unknown id. */
export function ChannelScreen({ roomId, channelId }: ChannelScreenProps) {
  const { data: room } = useSuspenseQuery(roomQueryOptions(roomId))
  const channel = room.channels.find((item) => item.id === channelId)

  if (!channel) {
    return (
      <ChannelNotFound
        roomId={room.room.id}
        roomName={room.room.name}
        defaultChannelId={room.defaultChannelId}
      />
    )
  }

  return channel.type === 'text' ? (
    <TextChannelView key={channel.id} room={room} channel={channel} />
  ) : (
    <VoiceChannelView key={channel.id} room={room} channel={channel} />
  )
}
