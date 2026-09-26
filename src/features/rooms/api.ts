import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api, ApiError, toApiError, withNetworkErrors } from '@/lib/api/client'
import { retryTransient } from '@/lib/api/retry'
import {
  dropRoom,
  getCachedRoomName,
  replaceCachedRoom,
  roomKeys,
  upsertRoomListEntry,
} from './room-cache'
import { focusMainHeading } from './focus-main-heading'
import type { CreateRoomBody, MyRoom, RoomDetail, UpdateRoomBody } from './types'

/** Largest page `GET /api/rooms` serves. */
const ROOMS_PAGE_SIZE = 100
/** Safety stop for paging (5,000 rooms); a cursor that repeats also stops it. */
const ROOMS_MAX_PAGES = 50

/** Every room the user is in, oldest membership first (all pages). */
export const roomsQueryOptions = queryOptions({
  queryKey: roomKeys.list,
  queryFn: async ({ signal }): Promise<MyRoom[]> => {
    const rooms: MyRoom[] = []
    const seenCursors = new Set<string>()
    let cursor: string | undefined
    for (let page = 0; page < ROOMS_MAX_PAGES; page++) {
      const result = await withNetworkErrors(() =>
        api.GET('/api/rooms', {
          params: { query: { limit: ROOMS_PAGE_SIZE, cursor } },
          signal,
        }),
      )
      if (!result.data) throw toApiError(result)
      rooms.push(...result.data.data)
      cursor = result.data.nextCursor ?? undefined
      if (!cursor || seenCursors.has(cursor)) break
      seenCursors.add(cursor)
    }
    return rooms
  },
  retry: retryTransient,
})

/** One room with its channels and members. A 404 (missing, or not a member) throws NOT_FOUND. */
export function roomQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: roomKeys.detail(roomId),
    queryFn: async ({ signal }): Promise<RoomDetail> => {
      const result = await withNetworkErrors(() =>
        api.GET('/api/rooms/{roomId}', { params: { path: { roomId } }, signal }),
      )
      if (result.data) return result.data
      throw toApiError(result)
    },
    retry: retryTransient,
  })
}

/** A 404 from the rooms API: the room is gone or the user isn't in it (indistinguishable). */
export function isRoomNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

export const OFFLINE_MESSAGE = "Couldn't reach Hideout. Check your connection and try again."

function isOffline(error: unknown) {
  return error instanceof ApiError && error.code === 'NETWORK'
}

interface CreateRoomOptions {
  /** Called once the room exists, before navigating to it (e.g. to stop a dialog restoring focus). */
  onCreated?: (detail: RoomDetail) => void
}

/**
 * Create a room. On success it's cached, added to the room list (then the list is refetched
 * for the server's `joinedAt`), and opened at its default channel, with focus moved to the
 * channel heading (the one place that does; only it knows when the new page is up). Errors are left to the
 * form (see `setRoomFieldErrors`). Not idempotent: keep the submit button disabled while
 * pending.
 */
export function useCreateRoom({ onCreated }: CreateRoomOptions = {}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (body: CreateRoomBody): Promise<RoomDetail> => {
      const result = await withNetworkErrors(() => api.POST('/api/rooms', { body }))
      if (result.data) return result.data
      throw toApiError(result)
    },
    onSuccess: async (detail) => {
      const roomId = detail.room.id
      queryClient.setQueryData(roomKeys.detail(roomId), detail)
      upsertRoomListEntry(queryClient, {
        room: detail.room,
        myRole: detail.myRole,
        joinedAt: new Date().toISOString(),
      })
      void queryClient.invalidateQueries({ queryKey: roomKeys.list, exact: true })
      onCreated?.(detail)
      if (detail.defaultChannelId) {
        await navigate({
          to: '/rooms/$roomId/$channelId',
          params: { roomId, channelId: detail.defaultChannelId },
        })
      } else {
        await navigate({ to: '/rooms/$roomId', params: { roomId } })
      }
      focusMainHeading()
    },
  })
}

/** Mutation keys, so realtime handlers can tell this tab's own in-flight changes apart. */
export const roomMutationKeys = {
  delete: (roomId: string) => ['rooms', 'delete', roomId] as const,
}

const ROOM_UNAVAILABLE_MESSAGE = "This room isn't available anymore."

/**
 * Rename a room or change its icon (owner or admin). Send only the fields that changed.
 * 403, 404, 429 and unexpected failures are toasted here; a 422 is left to the form.
 */
export function useUpdateRoom(roomId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (body: UpdateRoomBody): Promise<RoomDetail> => {
      const result = await withNetworkErrors(() =>
        api.PATCH('/api/rooms/{roomId}', { params: { path: { roomId } }, body }),
      )
      if (result.data) return result.data
      throw toApiError(result)
    },
    onSuccess: (detail) => {
      queryClient.setQueryData(roomKeys.detail(roomId), detail)
      replaceCachedRoom(queryClient, detail.room)
    },
    onError: async (error) => {
      if (!(error instanceof ApiError)) {
        toast.error("Couldn't save changes. Try again.")
        return
      }
      switch (error.status) {
        case 422:
          return
        case 403:
          toast.error('Only owners and admins can change room settings.')
          void queryClient.invalidateQueries({ queryKey: roomKeys.detail(roomId), exact: true })
          return
        case 404: {
          // Forget the room first: a realtime "room gone" for it arriving meanwhile then finds
          // nothing cached and doesn't toast again (and if it already ran, neither do we).
          const wasCached = getCachedRoomName(queryClient, roomId) !== undefined
          dropRoom(queryClient, roomId)
          if (wasCached) toast.error(ROOM_UNAVAILABLE_MESSAGE)
          await navigate({ to: '/', replace: true })
          return
        }
        case 429:
          toast.error('Too many changes. Try again later.')
          return
        default:
          toast.error(isOffline(error) ? OFFLINE_MESSAGE : "Couldn't save changes. Try again.")
      }
    },
  })
}

/**
 * Delete a room (owner only). 204, or a 404 (already gone), leaves the room: go Home, forget
 * it, and toast. Failures are toasted.
 */
export function useDeleteRoom(roomId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationKey: roomMutationKeys.delete(roomId),
    mutationFn: async (): Promise<void> => {
      const result = await withNetworkErrors(() =>
        api.DELETE('/api/rooms/{roomId}', { params: { path: { roomId } } }),
      )
      if (result.response.status === 204 || result.response.status === 404) return
      throw toApiError(result)
    },
    onSuccess: async () => {
      const name = getCachedRoomName(queryClient, roomId)
      await navigate({ to: '/', replace: true })
      dropRoom(queryClient, roomId)
      toast.success(name ? `Deleted ${name}` : 'Room deleted')
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 403) {
        toast.error('Only the owner can delete this room.')
        return
      }
      toast.error(isOffline(error) ? OFFLINE_MESSAGE : "Couldn't delete the room. Try again.")
    },
  })
}
