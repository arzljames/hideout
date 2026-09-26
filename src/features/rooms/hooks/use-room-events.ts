import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRealtimeReady } from '@/hooks/use-realtime-ready'
import { useRealtimeTopic } from '@/hooks/use-realtime-topic'
import { parseRoomEvent, realtimeTopics } from '@/lib/realtime/events'
import { STUCK_AFTER_MS, type TopicStatus } from '@/lib/realtime/topics'
import { isRoomNotFound, roomQueryOptions } from '../api'
import { applyRoomUpdated } from '../room-events'
import { useRoomGone } from './use-room-gone'

export interface RoomEventsState {
  /** Live updates for this room have been down for a while; show a non-blocking banner. */
  paused: boolean
}

/**
 * Live updates for an open room, on the private `room:<roomId>` topic:
 * - `room:updated` replaces the cached name and icon; `room:deleted` leaves, drops, and toasts.
 * - After rejoining (broadcasts sent meanwhile are lost), refetch the room.
 * - When the topic is stuck (no SUBSCRIBED for ~30 s or 5 attempts), or Realtime has no token
 *   for ~30 s, recheck the room: a 404 means it's gone for us (leave, drop, toast); otherwise
 *   report `paused` until the topic subscribes again.
 */
export function useRoomEvents(roomId: string): RoomEventsState {
  const queryClient = useQueryClient()
  const roomGone = useRoomGone()
  const ready = useRealtimeReady()
  const [paused, setPaused] = useState(false)
  const subscribed = useRef(false)

  const recheckRoom = useCallback(
    async ({ pauseIfAvailable }: { pauseIfAvailable: boolean }) => {
      try {
        await queryClient.fetchQuery({ ...roomQueryOptions(roomId), staleTime: 0 })
        if (pauseIfAvailable && !subscribed.current) setPaused(true)
      } catch (error) {
        if (isRoomNotFound(error)) {
          await roomGone(roomId, 'removed')
          return
        }
        if (pauseIfAvailable && !subscribed.current) setPaused(true)
      }
    },
    [queryClient, roomGone, roomId],
  )

  // A new room starts fresh.
  const [trackedRoomId, setTrackedRoomId] = useState(roomId)
  if (trackedRoomId !== roomId) {
    setTrackedRoomId(roomId)
    setPaused(false)
  }
  useEffect(() => {
    subscribed.current = false
  }, [roomId])

  // No token for a while (e.g. the token endpoint is rate limited): live updates are paused too.
  useEffect(() => {
    if (ready) return
    const timer = setTimeout(() => setPaused(true), STUCK_AFTER_MS)
    return () => clearTimeout(timer)
  }, [ready, roomId])

  useRealtimeTopic(realtimeTopics.room(roomId), {
    onBroadcast: (event, payload) => {
      const parsed = parseRoomEvent(event, payload)
      if (!parsed) return
      switch (parsed.event) {
        case 'room:updated':
          if (parsed.data.room.id.toLowerCase() !== roomId.toLowerCase()) return
          applyRoomUpdated(queryClient, parsed.data)
          return
        case 'room:deleted':
          if (parsed.data.id.toLowerCase() !== roomId.toLowerCase()) return
          void roomGone(roomId, 'deleted')
          return
      }
    },
    onStatus: (status: TopicStatus) => {
      if (status.type === 'subscribed') {
        subscribed.current = true
        setPaused(false)
        if (status.afterError) void recheckRoom({ pauseIfAvailable: false })
        return
      }
      subscribed.current = false
      void recheckRoom({ pauseIfAvailable: true })
    },
  })

  return { paused }
}
