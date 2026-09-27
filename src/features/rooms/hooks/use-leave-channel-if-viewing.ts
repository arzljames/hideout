import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'
import { leaveVoiceIn } from '@/features/voice'
import { getCachedChannels, lowestTextChannel } from '../channel-cache'
import { sameRoomId } from '../room-cache'

/**
 * For a channel that's gone (deleted here, or `channel:deleted` from realtime): returns
 * `leave(roomId, channelId)`. If the current route is that channel's page, it navigates
 * (replacing the history entry) to the room's lowest-position text channel from the cache, or to
 * the room itself when there is none. If you're in that voice channel, you leave it.
 * Call it before or after `removeChannel`; the gone channel is never picked as the target.
 * Resolves to whether it navigated.
 */
export function useLeaveChannelIfViewing() {
  const router = useRouter()
  const queryClient = useQueryClient()

  return useCallback(
    async (roomId: string, channelId: string): Promise<boolean> => {
      leaveVoiceIn({ roomId, channelId })

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
