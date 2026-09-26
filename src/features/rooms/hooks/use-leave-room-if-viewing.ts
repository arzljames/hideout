import { useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { sameRoomId } from '../room-cache'

/**
 * For "room gone" events (deleted, removed, banned): returns `leave(roomId, message?)`, which
 * toasts `message` (when given) and, if the current route is inside that room (its page or its
 * settings), goes Home, replacing the history entry. Resolves to whether it navigated.
 */
export function useLeaveRoomIfViewing() {
  const router = useRouter()

  return useCallback(
    async (roomId: string, message?: string): Promise<boolean> => {
      if (message) toast(message)
      const viewing = router.state.matches.some((match) => {
        const viewed = (match.params as { roomId?: string }).roomId
        return viewed !== undefined && sameRoomId(viewed, roomId)
      })
      if (!viewing) return false
      await router.navigate({ to: '/', replace: true })
      return true
    },
    [router],
  )
}
