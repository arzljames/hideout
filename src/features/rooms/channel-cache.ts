import type { QueryClient } from '@tanstack/react-query'
import { roomKeys, sameRoomId } from './room-cache'
import type { Channel, RoomDetail } from './types'

// Channels live only in the room detail cache (RoomDetail.channels: text first, then voice,
// each by position). These helpers keep that order and `defaultChannelId` (the lowest-position
// text channel) in step. All are no-ops while the room detail isn't cached. Ids are UUIDs and
// compare case-insensitively (`sameRoomId` works for any UUID).

export type ChannelType = Channel['type']

/**
 * Mutation keys for channel writes, so realtime handlers can tell this tab's own in-flight
 * changes apart: `reorder` (see `isReorderingChannels`), e.g. to skip `channel:reordered` echoes
 * that would briefly undo an optimistic order; `delete` (see `isDeletingChannel`), to leave the
 * toast and navigation to the delete mutation.
 */
export const channelMutationKeys = {
  all: ['channels'] as const,
  reorder: (roomId: string) => ['channels', 'reorder', roomId.toLowerCase()] as const,
  delete: (channelId: string) => ['channels', 'delete', channelId.toLowerCase()] as const,
}

/** True while this tab has a channel reorder for the room in flight. */
export function isReorderingChannels(queryClient: QueryClient, roomId: string): boolean {
  return queryClient.isMutating({ mutationKey: channelMutationKeys.reorder(roomId) }) > 0
}

/**
 * Call `callback` once no channel reorder for the room is in flight in this tab (at once if none
 * is). Returns a function that cancels the wait.
 *
 * Mutation cache listeners run synchronously when a PUT settles, before `useReorderChannels`'
 * queue has sent the next queued drop (it does so a few microtasks later). So "idle" is
 * confirmed again on the next task before `callback` runs; a follow-up PUT keeps waiting.
 */
export function whenChannelReorderSettles(
  queryClient: QueryClient,
  roomId: string,
  callback: () => void,
): () => void {
  if (!isReorderingChannels(queryClient, roomId)) {
    callback()
    return () => {}
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const unsubscribe = queryClient.getMutationCache().subscribe(() => {
    clearTimeout(timer)
    timer = undefined
    if (isReorderingChannels(queryClient, roomId)) return
    timer = setTimeout(() => {
      timer = undefined
      if (isReorderingChannels(queryClient, roomId)) return
      unsubscribe()
      callback()
    }, 0)
  })
  return () => {
    clearTimeout(timer)
    unsubscribe()
  }
}

/** True while this tab is deleting the channel. */
export function isDeletingChannel(queryClient: QueryClient, channelId: string): boolean {
  return queryClient.isMutating({ mutationKey: channelMutationKeys.delete(channelId) }) > 0
}

const TYPE_ORDER: Record<ChannelType, number> = { text: 0, voice: 1 }

/** Text first, then voice, each by position (stable, so equal positions keep their order). */
export function sortChannels(channels: readonly Channel[]): Channel[] {
  return [...channels].sort(
    (a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.position - b.position,
  )
}

/** The lowest-position text channel, optionally ignoring one channel (e.g. one being deleted). */
export function lowestTextChannel(
  channels: readonly Channel[],
  exceptChannelId?: string,
): Channel | undefined {
  return sortChannels(channels).find(
    (channel) =>
      channel.type === 'text' &&
      (exceptChannelId === undefined || !sameRoomId(channel.id, exceptChannelId)),
  )
}

function withChannels(detail: RoomDetail, channels: readonly Channel[]): RoomDetail {
  const sorted = sortChannels(channels)
  return {
    ...detail,
    channels: sorted,
    defaultChannelId: lowestTextChannel(sorted)?.id ?? null,
  }
}

function updateChannels(
  queryClient: QueryClient,
  roomId: string,
  update: (channels: Channel[]) => Channel[],
) {
  queryClient.setQueryData<RoomDetail>(roomKeys.detail(roomId), (detail) =>
    detail ? withChannels(detail, update(detail.channels)) : detail,
  )
}

/** The room's cached channels (text first, then voice), or undefined when it isn't cached. */
export function getCachedChannels(queryClient: QueryClient, roomId: string): Channel[] | undefined {
  return queryClient.getQueryData<RoomDetail>(roomKeys.detail(roomId))?.channels
}

/** Add a channel (e.g. created) or replace it (renamed), keeping the order. */
export function upsertChannel(queryClient: QueryClient, roomId: string, channel: Channel): void {
  updateChannels(queryClient, roomId, (channels) => {
    const index = channels.findIndex((item) => sameRoomId(item.id, channel.id))
    if (index === -1) return [...channels, channel]
    return channels.map((item, i) => (i === index ? channel : item))
  })
}

/** Forget a deleted channel. Returns the removed channel, if it was cached. */
export function removeChannel(
  queryClient: QueryClient,
  roomId: string,
  channelId: string,
): Channel | undefined {
  const removed = getCachedChannels(queryClient, roomId)?.find((item) =>
    sameRoomId(item.id, channelId),
  )
  if (removed) {
    updateChannels(queryClient, roomId, (channels) =>
      channels.filter((item) => !sameRoomId(item.id, channelId)),
    )
  }
  return removed
}

/**
 * Put the room's channels of `type` in the order of `channelIds` (top first), renumbering their
 * positions 0..n-1. Ids that aren't cached are ignored; cached channels of that type missing
 * from `channelIds` keep their relative order after the listed ones.
 */
export function applyChannelOrder(
  queryClient: QueryClient,
  roomId: string,
  type: ChannelType,
  channelIds: readonly string[],
): void {
  updateChannels(queryClient, roomId, (channels) => {
    const ofType = sortChannels(channels).filter((channel) => channel.type === type)
    const rank = (channel: Channel) => {
      const index = channelIds.findIndex((id) => sameRoomId(id, channel.id))
      return index === -1 ? channelIds.length : index
    }
    const ordered = [...ofType].sort((a, b) => rank(a) - rank(b))
    return [
      ...channels.filter((channel) => channel.type !== type),
      ...ordered.map((channel, position) =>
        channel.position === position ? channel : { ...channel, position },
      ),
    ]
  })
}

/** Replace every cached channel of `type` with `channels` (e.g. a reorder response). */
export function replaceChannelsOfType(
  queryClient: QueryClient,
  roomId: string,
  type: ChannelType,
  channels: readonly Channel[],
): void {
  updateChannels(queryClient, roomId, (current) => [
    ...current.filter((channel) => channel.type !== type),
    ...channels.filter((channel) => channel.type === type),
  ])
}
