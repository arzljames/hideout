import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { meQueryOptions } from '@/features/auth'
import { replaceChannelParticipants, voiceParticipantsQueryOptions } from '@/features/voice'
import { useRealtimeReady } from '@/hooks/use-realtime-ready'
import { useRealtimeTopic } from '@/hooks/use-realtime-topic'
import { isolate } from '@/lib/bidi'
import { parseRoomEvent, realtimeTopics } from '@/lib/realtime/events'
import { STUCK_AFTER_MS, type TopicStatus } from '@/lib/realtime/topics'
import { isRoomNotFound, roomMutationKeys, roomQueryOptions } from '../api'
import {
  applyChannelOrder,
  channelMutationKeys,
  getCachedChannels,
  isDeletingChannel,
  isReorderingChannels,
  removeChannel,
  upsertChannel,
  whenChannelReorderSettles,
} from '../channel-cache'
import { roomKeys, sameRoomId } from '../room-cache'
import {
  applyMemberJoined,
  applyMemberLeft,
  applyMemberRoleChanged,
  applyRoomUpdated,
} from '../room-events'
import type { Channel, ReorderChannelsBody } from '../types'
import { useLeaveChannelIfViewing } from './use-leave-channel-if-viewing'
import { useRoomGone } from './use-room-gone'

/**
 * Whether `order` is exactly what one of this tab's in-flight reorder PUTs for the room sent,
 * i.e. the broadcast is our own echo (the PUT's response will say the same).
 */
function isOwnReorderEcho(queryClient: QueryClient, roomId: string, order: ReorderChannelsBody) {
  return queryClient
    .getMutationCache()
    .findAll({ mutationKey: channelMutationKeys.reorder(roomId), status: 'pending' })
    .some((mutation) => {
      const sent = mutation.state.variables as ReorderChannelsBody | undefined
      return (
        sent !== undefined &&
        sent.type === order.type &&
        sent.channelIds.length === order.channelIds.length &&
        sent.channelIds.every((id, index) => sameRoomId(id, order.channelIds[index]!))
      )
    })
}

/**
 * A `channel:updated` while this tab reorders: keep the cached (optimistic) position and take
 * the rest (e.g. the name). The server's position predates our reorder; the refetch after the
 * reorder settles reconciles both.
 */
function keepOptimisticPosition(queryClient: QueryClient, roomId: string, channel: Channel) {
  const cached = getCachedChannels(queryClient, roomId)?.find((item) =>
    sameRoomId(item.id, channel.id),
  )
  return cached ? { ...channel, position: cached.position } : channel
}

export interface RoomEventsState {
  /** Live updates for this room have been down for a while; show a non-blocking banner. */
  paused: boolean
}

/**
 * Live updates for an open room, on the private `room:<roomId>` topic:
 * - `room:updated` replaces the cached name and icon; `room:deleted` leaves, drops, and toasts.
 * - `channel:created` / `channel:updated` upsert the channel; `channel:reordered` applies the
 *   order, unless this tab has a reorder PUT in flight: then the optimistic order stays and the
 *   room is refetched once the reorder settles (the server's order wins, whoever was last). Our
 *   own echo (the exact order an in-flight PUT sent) needs no refetch; an update meanwhile keeps
 *   the channel's optimistic position and also refetches once the reorder settles.
 * - `member:joined` adds the member in role order (deduped by user id).
 * - `member:left` removes the member. When it's the signed-in user (left or removed elsewhere),
 *   the room is gone for us: leave, drop, toast. A leave this tab has in flight is left to its
 *   mutation, which navigates and toasts itself.
 * - `member:role_changed` updates the role and regroups the member; for the signed-in user
 *   `myRole` follows (so owner/admin controls appear or disappear).
 * - `channel:deleted` leaves the channel (and its voice session) if open, forgets it, and toasts
 *   when it was on screen. A delete this tab has in flight is left to its mutation.
 * - `voice:participants` replaces one voice channel's participant list; channels that aren't
 *   one of the room's voice channels are ignored. The list is loaded when the room opens
 *   (useRoomVoiceParticipants) and refetched after rejoining, since broadcasts are best-effort.
 * - Events naming another room are ignored.
 * - After rejoining (broadcasts sent meanwhile are lost), refetch the room.
 * - When the topic is stuck (no SUBSCRIBED for ~30 s or 5 attempts), or Realtime has no token
 *   for ~30 s, recheck the room: a 404 means it's gone for us (leave, drop, toast); otherwise
 *   report `paused` until the topic subscribes again.
 */
export function useRoomEvents(roomId: string): RoomEventsState {
  const queryClient = useQueryClient()
  const roomGone = useRoomGone()
  const leaveChannelIfViewing = useLeaveChannelIfViewing()
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

  // A `channel:reordered` that arrived during this tab's own reorder: refetch once it settles.
  const deferredReorder = useRef<(() => void) | undefined>(undefined)
  const deferReorderRefetch = useCallback(() => {
    if (deferredReorder.current) return
    const cancel = whenChannelReorderSettles(queryClient, roomId, () => {
      deferredReorder.current = undefined
      void queryClient.invalidateQueries({ queryKey: roomKeys.detail(roomId), exact: true })
    })
    if (isReorderingChannels(queryClient, roomId)) deferredReorder.current = cancel
  }, [queryClient, roomId])
  useEffect(
    () => () => {
      const cancel = deferredReorder.current
      if (!cancel) return
      deferredReorder.current = undefined
      cancel()
      // Left the room first: refetch it on the next visit instead.
      void queryClient.invalidateQueries({
        queryKey: roomKeys.detail(roomId),
        exact: true,
        refetchType: 'none',
      })
    },
    [queryClient, roomId],
  )

  const onChannelDeleted = useCallback(
    async (channelId: string) => {
      // This tab's own delete navigates and toasts itself.
      if (isDeletingChannel(queryClient, channelId)) return
      const name = getCachedChannels(queryClient, roomId)?.find((channel) =>
        sameRoomId(channel.id, channelId),
      )?.name
      // Navigate first (like the delete mutation), so the open channel never shows "doesn't
      // exist". Topics are per room today; once per-channel topics exist (`channel:<id>`,
      // `typing:<id>`), they must be released here too, not only when the channel unmounts.
      const wasViewing = await leaveChannelIfViewing(roomId, channelId)
      removeChannel(queryClient, roomId, channelId)
      if (wasViewing) toast(name ? `#${isolate(name)} was deleted.` : 'This channel was deleted.')
    },
    [leaveChannelIfViewing, queryClient, roomId],
  )

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
        case 'channel:created':
          if (!sameRoomId(parsed.data.channel.roomId, roomId)) return
          upsertChannel(queryClient, roomId, parsed.data.channel)
          return
        case 'channel:updated': {
          const { channel } = parsed.data
          if (!sameRoomId(channel.roomId, roomId)) return
          if (!isReorderingChannels(queryClient, roomId)) {
            upsertChannel(queryClient, roomId, channel)
            return
          }
          upsertChannel(queryClient, roomId, keepOptimisticPosition(queryClient, roomId, channel))
          // The PUT's response may predate this update (e.g. revert a rename): refetch after it.
          deferReorderRefetch()
          return
        }
        case 'channel:reordered':
          if (!sameRoomId(parsed.data.roomId, roomId)) return
          if (isReorderingChannels(queryClient, roomId)) {
            if (!isOwnReorderEcho(queryClient, roomId, parsed.data)) deferReorderRefetch()
            return
          }
          applyChannelOrder(queryClient, roomId, parsed.data.type, parsed.data.channelIds)
          return
        case 'channel:deleted':
          if (!sameRoomId(parsed.data.roomId, roomId)) return
          void onChannelDeleted(parsed.data.id)
          return
        case 'member:joined':
          if (!sameRoomId(parsed.data.member.roomId, roomId)) return
          applyMemberJoined(queryClient, roomId, parsed.data)
          return
        case 'member:left': {
          if (!sameRoomId(parsed.data.roomId, roomId)) return
          const viewerId = queryClient.getQueryData(meQueryOptions.queryKey)?.id
          if (viewerId === undefined || !sameRoomId(parsed.data.userId, viewerId)) {
            applyMemberLeft(queryClient, roomId, parsed.data)
            return
          }
          if (queryClient.isMutating({ mutationKey: roomMutationKeys.leave(roomId) }) > 0) return
          void roomGone(roomId, 'removed')
          return
        }
        case 'member:role_changed':
          if (!sameRoomId(parsed.data.roomId, roomId)) return
          applyMemberRoleChanged(
            queryClient,
            roomId,
            parsed.data,
            queryClient.getQueryData(meQueryOptions.queryKey)?.id,
          )
          return
        case 'voice:participants': {
          const { channelId, participants } = parsed.data
          const isVoiceChannel = getCachedChannels(queryClient, roomId)?.some(
            (channel) => channel.type === 'voice' && sameRoomId(channel.id, channelId),
          )
          if (!isVoiceChannel) return
          replaceChannelParticipants(queryClient, roomId, channelId, participants)
          return
        }
      }
    },
    onStatus: (status: TopicStatus) => {
      if (status.type === 'subscribed') {
        subscribed.current = true
        setPaused(false)
        if (status.afterError) {
          void recheckRoom({ pauseIfAvailable: false })
          // voice:participants sent while rejoining are lost too. Fetch directly: its readers
          // are passive (enabled: false), and invalidate/refetch skips queries whose observers
          // are all disabled, so it would never refetch while the sidebar shows the lists.
          void queryClient
            .fetchQuery({ ...voiceParticipantsQueryOptions(roomId), staleTime: 0 })
            .catch(() => {})
        }
        return
      }
      subscribed.current = false
      void recheckRoom({ pauseIfAvailable: true })
    },
  })

  return { paused }
}
