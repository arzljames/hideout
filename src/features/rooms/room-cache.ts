import type { QueryClient } from '@tanstack/react-query'
import type { MyRoom, Room, RoomDetail } from './types'

/** Room ids are UUIDs, which compare case-insensitively; the API returns them lowercase. */
export function sameRoomId(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Query keys for rooms. `detail` entries hold a RoomDetail; `list` holds every MyRoom. The
 * detail key is lowercased, so an id from a URL or an event finds the same entry.
 */
export const roomKeys = {
  all: ['rooms'] as const,
  list: ['rooms', 'list'] as const,
  detail: (roomId: string) => ['rooms', 'detail', roomId.toLowerCase()] as const,
}

export function getCachedRoomDetail(queryClient: QueryClient, roomId: string) {
  return queryClient.getQueryData<RoomDetail>(roomKeys.detail(roomId))
}

/** The room's name from the detail or list cache, if either holds it. */
export function getCachedRoomName(queryClient: QueryClient, roomId: string): string | undefined {
  return (
    getCachedRoomDetail(queryClient, roomId)?.room.name ??
    queryClient
      .getQueryData<MyRoom[]>(roomKeys.list)
      ?.find((entry) => sameRoomId(entry.room.id, roomId))?.room.name
  )
}

/** Add a room to the cached list (or replace its entry). No-op while the list isn't cached. */
export function upsertRoomListEntry(queryClient: QueryClient, entry: MyRoom) {
  queryClient.setQueryData<MyRoom[]>(roomKeys.list, (rooms) => {
    if (!rooms) return rooms
    const index = rooms.findIndex((item) => sameRoomId(item.room.id, entry.room.id))
    if (index === -1) return [...rooms, entry]
    return rooms.map((item, i) => (i === index ? entry : item))
  })
}

/** Replace a room's `room` fields (name, icon) in the detail and list caches, where cached. */
export function replaceCachedRoom(queryClient: QueryClient, room: Room) {
  queryClient.setQueryData<RoomDetail>(roomKeys.detail(room.id), (detail) =>
    detail ? { ...detail, room } : detail,
  )
  queryClient.setQueryData<MyRoom[]>(roomKeys.list, (rooms) =>
    rooms?.map((entry) => (sameRoomId(entry.room.id, room.id) ? { ...entry, room } : entry)),
  )
}

/**
 * Forget a room the user can no longer see (deleted, removed, banned, or a 404): drop it from
 * the list and remove its cached detail. Navigate away from the room before calling this where
 * possible, so a mounted room screen doesn't refetch it.
 */
export function dropRoom(queryClient: QueryClient, roomId: string) {
  queryClient.setQueryData<MyRoom[]>(roomKeys.list, (rooms) =>
    rooms?.filter((entry) => !sameRoomId(entry.room.id, roomId)),
  )
  void queryClient.cancelQueries({ queryKey: roomKeys.detail(roomId), exact: true })
  queryClient.removeQueries({ queryKey: roomKeys.detail(roomId), exact: true })
}
