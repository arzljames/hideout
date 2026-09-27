import type { QueryClient } from '@tanstack/react-query'
import { dropRoom, getCachedRoomName, replaceCachedRoom, roomKeys, sameRoomId } from './room-cache'
import type { Member, MyRoom, Role, Room, RoomDetail } from './types'

/** What a "room gone" event left behind, for the caller's toast and navigation. */
export interface RoomGone {
  roomId: string
  kind: RoomGoneKind
  /** The room's name from the cache before it was dropped, if it was known. */
  name: string | undefined
  /** False when the room wasn't cached (e.g. this tab already handled it): skip the toast. */
  wasCached: boolean
}

export type RoomGoneKind = 'deleted' | 'removed' | 'banned'

/** `room:updated`: replace the room's name and icon wherever it's cached. */
export function applyRoomUpdated(queryClient: QueryClient, { room }: { room: Room }): void {
  replaceCachedRoom(queryClient, room)
}

const ROLE_ORDER: Record<Role, number> = { owner: 0, admin: 1, member: 2 }

/** The API's member order: owner, then admins, then members, each by name. */
function compareMembers(a: Member, b: Member): number {
  return (
    ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
    a.user.displayName.localeCompare(b.user.displayName)
  )
}

/**
 * `member:joined`: add the member to the cached room in the API's order. A member already
 * listed (same user id, e.g. a repeat or our own join) is replaced, never duplicated.
 */
export function applyMemberJoined(
  queryClient: QueryClient,
  roomId: string,
  { member }: { member: Member },
): void {
  queryClient.setQueryData<RoomDetail>(roomKeys.detail(roomId), (detail) => {
    if (!detail) return detail
    const others = detail.members.filter((item) => !sameRoomId(item.user.id, member.user.id))
    const index = others.findIndex((item) => compareMembers(member, item) < 0)
    const members =
      index === -1 ? [...others, member] : [...others.slice(0, index), member, ...others.slice(index)]
    return { ...detail, members }
  })
}

/**
 * `member:left` (left or removed), or this tab's own optimistic remove: drop the member from the
 * cached room. No-op when they aren't listed.
 */
export function applyMemberLeft(
  queryClient: QueryClient,
  roomId: string,
  { userId }: { userId: string },
): void {
  queryClient.setQueryData<RoomDetail>(roomKeys.detail(roomId), (detail) => {
    if (!detail || !detail.members.some((item) => sameRoomId(item.user.id, userId))) return detail
    return { ...detail, members: detail.members.filter((item) => !sameRoomId(item.user.id, userId)) }
  })
}

/** Set the signed-in user's role in a room, in the detail and list caches, where cached. */
export function setCachedMyRole(queryClient: QueryClient, roomId: string, myRole: Role): void {
  queryClient.setQueryData<RoomDetail>(roomKeys.detail(roomId), (detail) =>
    detail && detail.myRole !== myRole ? { ...detail, myRole } : detail,
  )
  queryClient.setQueryData<MyRoom[]>(roomKeys.list, (rooms) =>
    rooms?.map((entry) => (sameRoomId(entry.room.id, roomId) ? { ...entry, myRole } : entry)),
  )
}

/**
 * `member:role_changed`: update the member's role and move them to their new group (a transfer
 * sends two: the old owner → admin, the new owner → owner). When it's the signed-in user
 * (`viewerId`), `myRole` follows, so role-gated controls update. A member who isn't listed is
 * ignored (a refetch will bring them).
 */
export function applyMemberRoleChanged(
  queryClient: QueryClient,
  roomId: string,
  { userId, role }: { userId: string; role: Role },
  viewerId: string | undefined,
): void {
  queryClient.setQueryData<RoomDetail>(roomKeys.detail(roomId), (detail) => {
    if (!detail) return detail
    const member = detail.members.find((item) => sameRoomId(item.user.id, userId))
    if (!member || member.role === role) return detail
    const members = detail.members
      .map((item) => (item === member ? { ...item, role } : item))
      .sort(compareMembers)
    return { ...detail, members }
  })
  if (viewerId !== undefined && sameRoomId(userId, viewerId)) {
    setCachedMyRole(queryClient, roomId, role)
  }
}

function goneRoom(queryClient: QueryClient, roomId: string, kind: RoomGoneKind): RoomGone {
  const name = getCachedRoomName(queryClient, roomId)
  const wasCached = name !== undefined
  dropRoom(queryClient, roomId)
  return { roomId, kind, name, wasCached }
}

/** `room:deleted`: forget the room. */
export function applyRoomDeleted(queryClient: QueryClient, { id }: { id: string }): RoomGone {
  return goneRoom(queryClient, id, 'deleted')
}

/** `member:removed` for the signed-in user (removed or banned): forget the room. */
export function applyMemberRemoved(
  queryClient: QueryClient,
  { roomId, banned }: { roomId: string; banned?: boolean },
): RoomGone {
  return goneRoom(queryClient, roomId, banned ? 'banned' : 'removed')
}

/** Toast copy for losing access to a room. */
export function roomGoneMessage(kind: RoomGoneKind, name?: string): string {
  const room = name ?? 'this room'
  switch (kind) {
    case 'deleted':
      return name ? `${name} was deleted.` : 'This room was deleted.'
    case 'removed':
      return `You're no longer in ${room}.`
    case 'banned':
      return `You were banned from ${room}.`
  }
}
