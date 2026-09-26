import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'
import { resetVoiceStore, useVoiceStore } from '@/features/voice'
import { getCachedChannels, lowestTextChannel } from '../channel-cache'
import { sameRoomId } from '../room-cache'

/**
 * For a channel that's gone (deleted here, or `channel:deleted` from realtime): returns
 * `leave(roomId, channelId)`. If the current route is that channel's page, it navigates
 * (replacing the history entry) to the room's lowest-position text channel from the cache, or to
 * the room itself when there is none. If the voice session is in that channel, it's reset.
 * Call it before or after `removeChannel`; the gone channel is never picked as the target.
 * Resolves to whether it navigated.
 */
export function useLeaveChannelIfViewing() {
  const router = useRouter()
  const queryClient = useQueryClient()

  return useCallback(
    async (roomId: string, channelId: string): Promise<boolean> => {
      // TODO(livekit): disconnecting the LiveKit Room belongs to the voice session; for now the
      // store is UI state only, so resetting it is the whole "leave".
      const connection = useVoiceStore.getState().connection
      if (
        connection &&
        sameRoomId(connection.roomId, roomId) &&
        sameRoomId(connection.channelId, channelId)
      ) {
        resetVoiceStore()
      }

      const viewing = router.state.matches.some((match) => {
        if (match.routeId !== '/_app/rooms/$roomId/$channelId') return false
        const params = match.params as { roomId?: string; channelId?: string }
        return (
          params.roomId !== undefined &&
          params.channelId !== undefined &&
          sameRoomId(params.roomId, roomId) &&
          sameRoomId(params.channelId, channelId)
        )
      })
      if (!viewing) return false

      const next = lowestTextChannel(getCachedChannels(queryClient, roomId) ?? [], channelId)
      if (next) {
        await router.navigate({
          to: '/rooms/$roomId/$channelId',
          params: { roomId, channelId: next.id },
          replace: true,
        })
      } else {
        await router.navigate({ to: '/rooms/$roomId', params: { roomId }, replace: true })
      }
      return true
    },
    [router, queryClient],
  )
}
