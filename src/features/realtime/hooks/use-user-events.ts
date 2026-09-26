import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { endSession } from '@/features/auth'
import { roomKeys, useRoomGone } from '@/features/rooms'
import { useRealtimeTopic } from '@/hooks/use-realtime-topic'
import { parseUserEvent, realtimeTopics } from '@/lib/realtime/events'

/**
 * The signed-in user's private `user:<profileId>` topic:
 * - `member:removed`: removed or banned from a room; leave it if open, forget it, toast.
 * - `session:expired`: "Sign out everywhere" ran elsewhere; run the normal sign-out teardown.
 * After rejoining (broadcasts sent meanwhile are lost), refetch the room list.
 * Invite events on this topic belong to the invites feature and are ignored here.
 */
export function useUserEvents(profileId: string): void {
  const queryClient = useQueryClient()
  const router = useRouter()
  const roomGone = useRoomGone()

  useRealtimeTopic(realtimeTopics.user(profileId), {
    onBroadcast: (event, payload) => {
      const parsed = parseUserEvent(event, payload)
      if (!parsed) return
      switch (parsed.event) {
        case 'member:removed':
          void roomGone(parsed.data.roomId, parsed.data.banned ? 'banned' : 'removed')
          return
        case 'session:expired':
          void endSession(queryClient, () => router.navigate({ to: '/sign-in', replace: true }))
          return
      }
    },
    onStatus: (status) => {
      if (status.type === 'subscribed' && status.afterError) {
        void queryClient.invalidateQueries({ queryKey: roomKeys.list, exact: true })
      }
    },
  })
}
