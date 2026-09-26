import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { roomMutationKeys } from '../api'
import { applyMemberRemoved, applyRoomDeleted, roomGoneMessage, type RoomGoneKind } from '../room-events'
import { useLeaveRoomIfViewing } from './use-leave-room-if-viewing'

/**
 * For realtime "room gone" signals (`room:deleted`, `member:removed`, or a 404 when rechecking
 * a room): leave the room if it's on screen, then forget it and toast. No toast when the room
 * wasn't cached (already handled). A `deleted` for a room this tab is deleting is left to the
 * delete mutation, which navigates and toasts itself.
 */
export function useRoomGone() {
  const queryClient = useQueryClient()
  const leaveIfViewing = useLeaveRoomIfViewing()

  return useCallback(
    async (roomId: string, kind: RoomGoneKind): Promise<void> => {
      if (
        kind === 'deleted' &&
        queryClient.isMutating({ mutationKey: roomMutationKeys.delete(roomId) }) > 0
      ) {
        return
      }
      // Navigate first, so the mounted room screen doesn't refetch the room once it's dropped.
      await leaveIfViewing(roomId)
      const gone =
        kind === 'deleted'
          ? applyRoomDeleted(queryClient, { id: roomId })
          : applyMemberRemoved(queryClient, { roomId, banned: kind === 'banned' })
      if (gone.wasCached) toast(roomGoneMessage(gone.kind, gone.name))
    },
    [queryClient, leaveIfViewing],
  )
}
