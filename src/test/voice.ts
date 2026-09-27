import type { Channel, RoomDetail } from '@/features/rooms'
import { useVoiceSession, type VoiceSession } from '@/features/voice'

/** Put the voice store in a connected session (no LiveKit Room behind it). */
export function setVoiceConnected(
  room: RoomDetail,
  channel: Channel,
  extra: Partial<VoiceSession> = {},
) {
  useVoiceSession.setState({
    status: 'connected',
    roomId: room.room.id,
    roomName: room.room.name,
    channelId: channel.id,
    channelName: channel.name,
    quality: 'good',
    ...extra,
  })
}
