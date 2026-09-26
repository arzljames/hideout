import type { QueryClient } from '@tanstack/react-query'
import { notFound, redirect, type ParsedLocation } from '@tanstack/react-router'
import { isRoomNotFound, roomQueryOptions } from './api'
import { dropRoom } from './room-cache'
import type { RoomDetail } from './types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Room ids are UUIDs; anything else can't be a room, so it's a 404 without asking the API. */
export function isRoomId(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value)
}

/**
 * `beforeLoad` for room routes: a room id with uppercase letters is the same room, so replace
 * the URL with the lowercase id (the API's form). Keeps one spelling per room in the router
 * and cache, so realtime events and "leave if viewing" match it.
 */
export function redirectToLowercaseRoomId({
  location,
  params,
}: {
  location: ParsedLocation
  params: { roomId: string }
}) {
  const { roomId } = params
  if (!isRoomId(roomId) || roomId === roomId.toLowerCase()) return
  throw redirect({
    href: `${location.pathname.replace(roomId, roomId.toLowerCase())}${location.searchStr}${location.hash ? `#${location.hash}` : ''}`,
    replace: true,
  })
}

/**
 * For route loaders and guards: the room from the cache or the API. A malformed id or an API
 * 404 (missing room, or not a member) forgets the room and throws `notFound()`, so both show
 * the same "room not available" screen. Other failures throw to the errorComponent.
 */
export async function loadRoom(queryClient: QueryClient, roomId: string): Promise<RoomDetail> {
  if (!isRoomId(roomId)) throw notFound()
  try {
    return await queryClient.ensureQueryData(roomQueryOptions(roomId))
  } catch (error) {
    if (isRoomNotFound(error)) {
      dropRoom(queryClient, roomId)
      throw notFound()
    }
    throw error
  }
}
