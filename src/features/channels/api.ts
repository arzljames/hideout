import {
  useIsMutating,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { toast } from 'sonner'
import {
  applyChannelOrder,
  channelMutationKeys,
  focusMainHeading,
  getCachedChannels,
  removeChannel,
  roomKeys,
  sameRoomId,
  upsertChannel,
  useLeaveChannelIfViewing,
  type Channel,
  type ChannelType,
  type CreateChannelBody,
  type ReorderChannelsBody,
} from '@/features/rooms'
import { api, ApiError, toApiError, withNetworkErrors } from '@/lib/api/client'
import { isolate } from '@/lib/bidi'
import { CHANNEL_MESSAGES, isChannelOrderStale } from './channel-errors'
import { useChannelErrorEffects, type ChannelErrorOutcome } from './hooks/use-channel-error-effects'

interface CreateChannelOptions {
  /**
   * Open a new text channel (and focus its heading). Default true; Room settings passes false
   * so the user can keep managing channels. Voice channels never open.
   */
  openTextChannel?: boolean
  /** Called once the channel is cached, before navigating to it (e.g. so a dialog skips focus return). */
  onCreated?: (channel: Channel, opening: boolean) => void
}

/**
 * Create a channel (owner or admin). On success it's added to the room's cached channels; a
 * text channel then opens with focus on its heading. Errors are left to the form (see
 * `setChannelFieldErrors`, `channelErrorMessage`, `useChannelErrorEffects`). Not idempotent:
 * guard against double submits and keep submit disabled while pending.
 */
export function useCreateChannel(
  roomId: string,
  { openTextChannel = true, onCreated }: CreateChannelOptions = {},
) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (body: CreateChannelBody): Promise<Channel> => {
      const result = await withNetworkErrors(() =>
        api.POST('/api/rooms/{roomId}/channels', { params: { path: { roomId } }, body }),
      )
      if (result.data) return result.data
      throw toApiError(result)
    },
    onSuccess: async (channel) => {
      upsertChannel(queryClient, roomId, channel)
      const opening = openTextChannel && channel.type === 'text'
      onCreated?.(channel, opening)
      if (!opening) return
      await navigate({
        to: '/rooms/$roomId/$channelId',
        params: { roomId, channelId: channel.id },
      })
      focusMainHeading()
    },
  })
}

/** Rename a channel (owner or admin). Errors are left to the form. */
export function useRenameChannel(roomId: string, channelId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string): Promise<Channel> => {
      const result = await withNetworkErrors(() =>
        api.PATCH('/api/channels/{channelId}', {
          params: { path: { channelId } },
          body: { name },
        }),
      )
      if (result.data) return result.data
      throw toApiError(result)
    },
    onSuccess: (channel) => {
      upsertChannel(queryClient, roomId, channel)
    },
  })
}

/**
 * Delete a channel (owner or admin). 204, or a 404 (already gone), leaves the channel if it's
 * open (and its voice session), forgets it, and toasts. Errors (e.g. 409 LAST_TEXT_CHANNEL) are
 * left to the confirmation dialog.
 */
export function useDeleteChannel(roomId: string, channel: Pick<Channel, 'id' | 'name'>) {
  const queryClient = useQueryClient()
  const leaveIfViewing = useLeaveChannelIfViewing()

  return useMutation({
    mutationKey: channelMutationKeys.delete(channel.id),
    mutationFn: async (): Promise<void> => {
      const result = await withNetworkErrors(() =>
        api.DELETE('/api/channels/{channelId}', { params: { path: { channelId: channel.id } } }),
      )
      if (result.response.status === 204 || result.response.status === 404) return
      throw toApiError(result)
    },
    onSuccess: async () => {
      // Navigate first, so the open channel screen never shows "doesn't exist".
      await leaveIfViewing(roomId, channel.id)
      removeChannel(queryClient, roomId, channel.id)
      toast.success(`Deleted #${isolate(channel.name)}`)
    },
  })
}

// --- Reorder -------------------------------------------------------------------------------

/**
 * Per room: drops waiting to be sent (the latest order per type; an older unsent one is
 * superseded) and the last order the server confirmed per type, to restore on failure. One
 * queue per QueryClient and room, shared by every component that reorders, so only one PUT is
 * ever in flight for a room.
 */
interface ReorderQueue {
  running: boolean
  pending: Map<ChannelType, string[]>
  confirmed: Map<ChannelType, string[]>
  send: (body: ReorderChannelsBody) => Promise<Channel[]>
  onFailure: (error: unknown) => Promise<void>
}

// Bounded: one small entry per room reordered in this QueryClient's lifetime, dropped with it.
const reorderQueues = new WeakMap<QueryClient, Map<string, ReorderQueue>>()

function getReorderQueue(queryClient: QueryClient, roomId: string, init: () => ReorderQueue) {
  let rooms = reorderQueues.get(queryClient)
  if (!rooms) {
    rooms = new Map()
    reorderQueues.set(queryClient, rooms)
  }
  const key = roomId.toLowerCase()
  let queue = rooms.get(key)
  if (!queue) {
    queue = init()
    rooms.set(key, queue)
  }
  return queue
}

function idsOfType(channels: readonly Channel[], type: ChannelType): string[] {
  return channels.filter((channel) => channel.type === type).map((channel) => channel.id)
}

function sameOrder(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((id, index) => sameRoomId(id, b[index] ?? ''))
}

async function runReorderQueue(queryClient: QueryClient, roomId: string, queue: ReorderQueue) {
  queue.running = true
  try {
    for (;;) {
      const next = queue.pending.entries().next()
      if (next.done) return
      const [type, channelIds] = next.value
      queue.pending.delete(type)
      try {
        const channels = await queue.send({ type, channelIds })
        if (queue.pending.has(type)) {
          // A newer drop is waiting and on screen; this response is only the new baseline.
          queue.confirmed.set(type, idsOfType(channels, type))
        } else {
          // Take only the order from the response, never its channels: one deleted, created
          // or renamed while the PUT was in flight (realtime, or this tab) must stay as cached.
          applyChannelOrder(queryClient, roomId, type, idsOfType(channels, type))
          queue.confirmed.delete(type)
        }
      } catch (error) {
        // Put back what the server last confirmed. Only this type's order changes, so
        // channels created or deleted meanwhile (realtime) stay as they are.
        const confirmed = queue.confirmed.get(type)
        queue.pending.delete(type)
        queue.confirmed.delete(type)
        if (confirmed) applyChannelOrder(queryClient, roomId, type, confirmed)
        await queue.onFailure(error)
      }
    }
  } finally {
    queue.running = false
  }
}

const REORDER_FALLBACK_MESSAGE = "Couldn't move the channel. Try again."

/**
 * Reorder a room's channels of one type (owner or admin), optimistically. `reorder(type, ids)`
 * applies the order to the cache at once and queues one PUT (call it once per drop, never while
 * dragging). Only one PUT per room is in flight; drops made meanwhile are sent next (the latest
 * per type). Success applies the server's order (not its channel snapshot). Failure restores the last
 * confirmed order and toasts; CHANNEL_ORDER_STALE also refetches the room.
 *
 * While a PUT is in flight the mutation key `channelMutationKeys.reorder(roomId)` is active
 * (`isReorderingChannels(queryClient, roomId)` from @/features/rooms).
 */
export function useReorderChannels(roomId: string) {
  const queryClient = useQueryClient()
  const errorEffects = useChannelErrorEffects(roomId)
  const mutationKey = channelMutationKeys.reorder(roomId)
  const { mutateAsync } = useMutation({
    mutationKey,
    mutationFn: async (body: ReorderChannelsBody): Promise<Channel[]> => {
      const result = await withNetworkErrors(() =>
        api.PUT('/api/rooms/{roomId}/channels/order', { params: { path: { roomId } }, body }),
      )
      if (result.data) return result.data.data
      throw toApiError(result)
    },
  })
  const isReordering = useIsMutating({ mutationKey }) > 0

  const onFailure = useCallback(
    async (error: unknown) => {
      if (isChannelOrderStale(error)) {
        void queryClient.invalidateQueries({ queryKey: roomKeys.detail(roomId), exact: true })
        toast.error(CHANNEL_MESSAGES.orderStale)
        return
      }
      if (!(error instanceof ApiError)) {
        toast.error(REORDER_FALLBACK_MESSAGE)
        return
      }
      if (error.code === 'NETWORK') {
        toast.error(CHANNEL_MESSAGES.offline)
        return
      }
      if (error.status === 429) {
        toast.error(CHANNEL_MESSAGES.rateLimited)
        return
      }
      const outcome: ChannelErrorOutcome = await errorEffects(error)
      if (outcome === 'room-gone') return // The room-gone path toasted.
      toast.error(outcome === 'forbidden' ? CHANNEL_MESSAGES.forbidden : REORDER_FALLBACK_MESSAGE)
    },
    [errorEffects, queryClient, roomId],
  )

  const reorder = useCallback(
    (type: ChannelType, channelIds: readonly string[]) => {
      const current = getCachedChannels(queryClient, roomId)
      if (!current) return
      const currentIds = idsOfType(current, type)
      if (sameOrder(currentIds, channelIds)) return

      const queue = getReorderQueue(queryClient, roomId, () => ({
        running: false,
        pending: new Map(),
        confirmed: new Map(),
        send: mutateAsync,
        onFailure,
      }))
      // The latest caller's functions: an unmounted caller's still work, but these are fresher.
      queue.send = mutateAsync
      queue.onFailure = onFailure
      if (!queue.confirmed.has(type)) queue.confirmed.set(type, currentIds)

      // A room refetch landing now would put the old order back.
      void queryClient.cancelQueries({ queryKey: roomKeys.detail(roomId), exact: true })
      applyChannelOrder(queryClient, roomId, type, channelIds)
      queue.pending.set(type, [...channelIds])
      if (!queue.running) void runReorderQueue(queryClient, roomId, queue)
    },
    [mutateAsync, onFailure, queryClient, roomId],
  )

  return { reorder, isReordering }
}
