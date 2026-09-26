import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { isRoomNotFound, roomKeys, roomQueryOptions, useRoomGone } from '@/features/rooms'
import { ApiError } from '@/lib/api/client'

/** What a failed channel write meant for the room, beyond its message. */
export type ChannelErrorOutcome =
  /** 403: the user can't manage channels (anymore). The room is being refetched. */
  | 'forbidden'
  /** 404 and the room is gone for us: the room-gone path navigated away, dropped and toasted. */
  | 'room-gone'
  /** 404 but the room is still there: the channel is gone; the refetch removed it. */
  | 'channel-gone'
  /** Anything else: nothing to do beyond showing the message. */
  | 'none'

/**
 * Side effects shared by every channel write's failure: a 403 refetches the room (so its role,
 * and the management controls, catch up); a 404 rechecks the room and, if the room itself is
 * gone, takes the rooms feature's room-gone path.
 */
export function useChannelErrorEffects(roomId: string) {
  const queryClient = useQueryClient()
  const roomGone = useRoomGone()

  return useCallback(
    async (error: unknown): Promise<ChannelErrorOutcome> => {
      if (!(error instanceof ApiError)) return 'none'
      if (error.status === 403) {
        void queryClient.invalidateQueries({ queryKey: roomKeys.detail(roomId), exact: true })
        return 'forbidden'
      }
      if (error.status !== 404) return 'none'
      try {
        await queryClient.fetchQuery({ ...roomQueryOptions(roomId), staleTime: 0 })
        return 'channel-gone'
      } catch (recheckError) {
        if (isRoomNotFound(recheckError)) {
          await roomGone(roomId, 'removed')
          return 'room-gone'
        }
        // Couldn't recheck (e.g. offline): assume the channel is what's missing.
        return 'channel-gone'
      }
    },
    [queryClient, roomGone, roomId],
  )
}
