import type { QueryClient } from '@tanstack/react-query'
import type { InboxInvite, Invite } from './types'

/** Invite ids are UUIDs; compare them case-insensitively. */
function sameId(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Query keys for invites. `preview` holds an InvitePreview, `room` a room's active invites
 * (every page), `inbox` the signed-in user's pending direct invites.
 */
export const inviteKeys = {
  all: ['invites'] as const,
  preview: (token: string) => ['invites', 'preview', token] as const,
  room: (roomId: string) => ['invites', 'room', roomId.toLowerCase()] as const,
  inbox: ['invites', 'inbox'] as const,
}

/** Still usable at `now` (the inbox can hold one that expired since it was fetched). */
export function isInboxInviteLive(invite: InboxInvite, now = Date.now()): boolean {
  return invite.expiresAt === null || Date.parse(invite.expiresAt) > now
}

/** Add (newest first) or replace an inbox entry. No-op while the inbox isn't cached. */
export function upsertInboxInvite(queryClient: QueryClient, invite: InboxInvite): void {
  queryClient.setQueryData<InboxInvite[]>(inviteKeys.inbox, (inbox) => {
    if (!inbox) return inbox
    return [invite, ...inbox.filter((item) => !sameId(item.inviteId, invite.inviteId))]
  })
}

/** Remove an inbox entry, if present. */
export function removeInboxInvite(queryClient: QueryClient, inviteId: string): void {
  queryClient.setQueryData<InboxInvite[]>(inviteKeys.inbox, (inbox) =>
    inbox?.some((item) => sameId(item.inviteId, inviteId))
      ? inbox.filter((item) => !sameId(item.inviteId, inviteId))
      : inbox,
  )
}

/** Remove an invite from a room's cached list, if present. */
export function removeRoomInvite(queryClient: QueryClient, roomId: string, inviteId: string): void {
  queryClient.setQueryData<Invite[]>(inviteKeys.room(roomId), (invites) =>
    invites?.filter((item) => !sameId(item.id, inviteId)),
  )
}
