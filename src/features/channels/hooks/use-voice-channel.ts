import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { meQueryOptions } from '@/features/auth'
import { getCachedRoomName, sameRoomId, type Channel, type ProfileSummary } from '@/features/rooms'
import { joinVoice, useVoiceChannelParticipants, useVoiceSession } from '@/features/voice'
import { ApiError } from '@/lib/api/client'
import { useChannelErrorEffects } from './use-channel-error-effects'

/**
 * `join(channel)`: join a voice channel of this room (leaving any other first). A 404 for the
 * token means the channel or the room is gone: the shared channel error effects recheck the
 * room (dropping the channel, or taking the room-gone path).
 */
export function useJoinVoiceChannel(roomId: string) {
  const queryClient = useQueryClient()
  const errorEffects = useChannelErrorEffects(roomId)

  return useCallback(
    async (channel: Channel): Promise<void> => {
      const result = await joinVoice({
        roomId,
        roomName: getCachedRoomName(queryClient, roomId) ?? '',
        channelId: channel.id,
        channelName: channel.name,
      })
      if (
        result.outcome === 'failed' &&
        result.error instanceof ApiError &&
        result.error.status === 404
      ) {
        await errorEffects(result.error)
      }
    },
    [errorEffects, queryClient, roomId],
  )
}

export interface VoiceChannelPresence {
  participants: ProfileSummary[]
  /** The signed-in user's profile id, if known. */
  viewerId: string | undefined
  /** You're connected (or reconnecting) to this channel. */
  here: boolean
  /** Speaking, by lowercased profile id; only known for the channel you're in. */
  isSpeaking: (profileId: string) => boolean
}

/**
 * Who's in a voice channel, from the room's participant list. While you're connected here and
 * the list doesn't have you yet (it follows LiveKit's webhook), you're added at the end.
 */
export function useVoiceChannelPresence(roomId: string, channelId: string): VoiceChannelPresence {
  const listed = useVoiceChannelParticipants(roomId, channelId)
  const { data: me } = useQuery({ ...meQueryOptions, enabled: false })
  const here = useVoiceSession(
    (s) =>
      (s.status === 'connected' || s.status === 'reconnecting') &&
      s.channelId !== null &&
      sameRoomId(s.channelId, channelId),
  )
  const speakingIds = useVoiceSession((s) => s.speakingIds)

  const participants = useMemo(() => {
    if (!here || !me || listed.some((person) => sameRoomId(person.id, me.id))) return listed
    return [...listed, { id: me.id, displayName: me.displayName, avatarUrl: me.avatarUrl }]
  }, [here, listed, me])

  const isSpeaking = useCallback(
    (profileId: string) => here && speakingIds.includes(profileId.toLowerCase()),
    [here, speakingIds],
  )

  return { participants, viewerId: me?.id, here, isSpeaking }
}
