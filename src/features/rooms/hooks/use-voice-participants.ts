import { useVoiceStore } from '@/features/voice'
import { getRoomMember, type Room, type RoomMember, type VoiceChannel } from '../sample-room'

export interface VoiceParticipantView {
  member: RoomMember
  muted: boolean
  deafened: boolean
  speaking: boolean
}

interface VoiceParticipants {
  participants: VoiceParticipantView[]
  /** Whether the signed-in user is connected to this channel. */
  viewerConnected: boolean
}

/**
 * Who's in a voice channel, as the UI shows it. The viewer appears only while the voice store
 * says they're connected to this channel, and their mute/deafen state comes from the store.
 * TODO(livekit): other participants' state from the Room instead of sample data.
 */
export function useVoiceParticipants(room: Room, channel: VoiceChannel): VoiceParticipants {
  const connection = useVoiceStore((s) => s.connection)
  const viewerMuted = useVoiceStore((s) => s.muted)
  const viewerDeafened = useVoiceStore((s) => s.deafened)
  const viewerConnected = connection?.roomId === room.id && connection.channelId === channel.id

  const participants: VoiceParticipantView[] = []
  for (const participant of channel.participants) {
    const member = getRoomMember(room, participant.memberId)
    if (!member) continue
    if (member.isViewer) {
      if (!viewerConnected) continue
      participants.push({ member, muted: viewerMuted, deafened: viewerDeafened, speaking: false })
    } else {
      participants.push({
        member,
        muted: Boolean(participant.muted),
        deafened: Boolean(participant.deafened),
        speaking: Boolean(participant.speaking),
      })
    }
  }

  return { participants, viewerConnected }
}
