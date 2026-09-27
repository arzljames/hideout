import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { toast } from 'sonner'
import {
  focusMainHeading,
  OFFLINE_MESSAGE,
  roomKeys,
  upsertRoomListEntry,
  type RoomDetail,
} from '@/features/rooms'
import { api, ApiError, toApiError, withNetworkErrors } from '@/lib/api/client'
import { retryTransient } from '@/lib/api/retry'
import { isolate } from '@/lib/bidi'
import {
  inviteKeys,
  removeInboxInvite,
  removeRoomInvite,
  upsertInboxInvite,
} from './invite-cache'
import { inviteErrorMessage, isInviteGone, RATE_LIMITED_MESSAGE } from './invite-errors'
import type { CreatedInvite, CreateInviteBody, InboxInvite, Invite, InvitePreview } from './types'

/** Public preview of a link invite. Any unusable link is a 404 (ApiError, status 404). */
export function invitePreviewQueryOptions(token: string) {
  return queryOptions({
    queryKey: inviteKeys.preview(token),
    queryFn: async ({ signal }): Promise<InvitePreview> => {
      const result = await withNetworkErrors(() =>
        api.GET('/api/invites/{token}/preview', {
          params: { path: { token } },
          signal,
          // The page URL holds the token; never send it as a Referer.
          referrerPolicy: 'no-referrer',
        }),
      )
      if (result.data) return result.data
      throw toApiError(result)
    },
    retry: retryTransient,
  })
}

/** Largest page `GET /api/rooms/{roomId}/invites` serves. */
const ROOM_INVITES_PAGE_SIZE = 100
/** Safety stop for paging; a cursor that repeats also stops it. */
const ROOM_INVITES_MAX_PAGES = 20

/**
 * A room's active invites, newest first (all pages). Owners and admins get every invite,
 * members only their own. A page can be short or empty while `nextCursor` is set.
 */
export function roomInvitesQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: inviteKeys.room(roomId),
    queryFn: async ({ signal }): Promise<Invite[]> => {
      const invites: Invite[] = []
      const seenCursors = new Set<string>()
      let cursor: string | undefined
      for (let page = 0; page < ROOM_INVITES_MAX_PAGES; page++) {
        const result = await withNetworkErrors(() =>
          api.GET('/api/rooms/{roomId}/invites', {
            params: {
              path: { roomId },
              query: { status: 'active', limit: ROOM_INVITES_PAGE_SIZE, cursor },
            },
            signal,
          }),
        )
        if (!result.data) throw toApiError(result)
        invites.push(...result.data.data)
        cursor = result.data.nextCursor ?? undefined
        if (!cursor || seenCursors.has(cursor)) break
        seenCursors.add(cursor)
      }
      return invites
    },
    retry: retryTransient,
  })
}

/**
 * The signed-in user's pending direct invites, newest first. Kept current by `invite:received`
 * / `invite:revoked`; entries can expire while cached, so filter with `isInboxInviteLive`.
 */
export const inboxQueryOptions = queryOptions({
  queryKey: inviteKeys.inbox,
  queryFn: async ({ signal }): Promise<InboxInvite[]> => {
    const result = await withNetworkErrors(() => api.GET('/api/me/invites', { signal }))
    if (result.data) return result.data.data
    throw toApiError(result)
  },
  retry: retryTransient,
})

/**
 * After joining a room (link or direct invite): cache it, add it to the room list (then refetch
 * the list for the server's `joinedAt`), and open its default channel.
 */
function useOpenJoinedRoom() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useCallback(
    async (detail: RoomDetail, { replace = false }: { replace?: boolean } = {}) => {
      const roomId = detail.room.id
      queryClient.setQueryData(roomKeys.detail(roomId), detail)
      upsertRoomListEntry(queryClient, {
        room: detail.room,
        myRole: detail.myRole,
        joinedAt: new Date().toISOString(),
      })
      void queryClient.invalidateQueries({ queryKey: roomKeys.list, exact: true })
      if (detail.defaultChannelId) {
        await navigate({
          to: '/rooms/$roomId/$channelId',
          params: { roomId, channelId: detail.defaultChannelId },
          replace,
        })
      } else {
        await navigate({ to: '/rooms/$roomId', params: { roomId }, replace })
      }
      focusMainHeading()
    },
    [queryClient, navigate],
  )
}

/**
 * Join with a link invite, then open the room. Idempotent on the server (a retry is
 * `already_member`). Errors are left to the invite page (see `inviteErrorMessage`).
 */
export function useRedeemInvite(token: string) {
  const queryClient = useQueryClient()
  const openJoinedRoom = useOpenJoinedRoom()

  return useMutation({
    mutationFn: async (): Promise<RoomDetail> => {
      const result = await withNetworkErrors(() =>
        api.POST('/api/invites/{token}/redeem', {
          params: { path: { token } },
          referrerPolicy: 'no-referrer',
        }),
      )
      if (result.data) return result.data.room
      throw toApiError(result)
    },
    onSuccess: async (detail) => {
      // Replace: Back shouldn't return to the spent /invite/<token> URL.
      await openJoinedRoom(detail, { replace: true })
      queryClient.removeQueries({ queryKey: inviteKeys.preview(token), exact: true })
    },
  })
}

/**
 * Create a link or direct invite. Errors are left to the form; the room's invite list is
 * refetched on success. Not idempotent: keep submit disabled while pending.
 */
export function useCreateInvite(roomId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: CreateInviteBody): Promise<CreatedInvite> => {
      const result = await withNetworkErrors(() =>
        api.POST('/api/rooms/{roomId}/invites', { params: { path: { roomId } }, body }),
      )
      if (result.data) return result.data
      throw toApiError(result)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inviteKeys.room(roomId), exact: true })
    },
  })
}

/**
 * Revoke an invite, optimistically removed from the room's list. 204 and 404 (already gone)
 * both count as done; other failures restore the list (refetch) and toast.
 */
export function useRevokeInvite(roomId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (inviteId: string): Promise<void> => {
      const result = await withNetworkErrors(() =>
        api.DELETE('/api/invites/{inviteId}', { params: { path: { inviteId } } }),
      )
      if (result.response.status === 204 || result.response.status === 404) return
      throw toApiError(result)
    },
    onMutate: async (inviteId) => {
      await queryClient.cancelQueries({ queryKey: inviteKeys.room(roomId), exact: true })
      removeRoomInvite(queryClient, roomId, inviteId)
    },
    onSuccess: () => {
      toast.success('Invite revoked')
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: inviteKeys.room(roomId), exact: true })
      if (error instanceof ApiError && error.status === 403) {
        toast.error('You can only revoke invites you created.')
      } else if (error instanceof ApiError && error.status === 429) {
        toast.error(RATE_LIMITED_MESSAGE)
      } else if (error instanceof ApiError && error.code === 'NETWORK') {
        toast.error(OFFLINE_MESSAGE)
      } else {
        toast.error("Couldn't revoke the invite. Try again.")
      }
    },
  })
}

/**
 * Shared by Accept and Decline: remove the entry optimistically. If the invite turns out to be
 * gone (404, 410, 409 INVITE_ALREADY_RESPONDED) it stays removed; otherwise it comes back.
 * Either way the reason is toasted.
 */
function useInboxResponse<T>(
  respond: (inviteId: string) => Promise<T>,
  fallback: string,
  onSuccess: (result: T, invite: InboxInvite) => Promise<void> | void,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (invite: InboxInvite) => respond(invite.inviteId),
    onMutate: async (invite) => {
      await queryClient.cancelQueries({ queryKey: inviteKeys.inbox, exact: true })
      removeInboxInvite(queryClient, invite.inviteId)
    },
    onSuccess,
    onError: (error, invite) => {
      if (!isInviteGone(error)) {
        upsertInboxInvite(queryClient, invite)
        // Put it back in the server's order.
        void queryClient.invalidateQueries({ queryKey: inviteKeys.inbox, exact: true })
      }
      toast.error(inviteErrorMessage(error, fallback))
    },
  })
}

/** Accept a direct invite, then open the room. */
export function useAcceptInvite() {
  const openJoinedRoom = useOpenJoinedRoom()

  return useInboxResponse(
    async (inviteId): Promise<RoomDetail> => {
      const result = await withNetworkErrors(() =>
        api.POST('/api/me/invites/{inviteId}/accept', { params: { path: { inviteId } } }),
      )
      if (result.data) return result.data.room
      throw toApiError(result)
    },
    "Couldn't accept the invite. Try again.",
    async (detail) => {
      // sonner's toaster is a polite live region: this announces the join.
      toast.success(`Joined ${isolate(detail.room.name)}`)
      await openJoinedRoom(detail)
    },
  )
}

/** Decline a direct invite (nobody is notified). */
export function useDeclineInvite() {
  return useInboxResponse(
    async (inviteId): Promise<void> => {
      const result = await withNetworkErrors(() =>
        api.POST('/api/me/invites/{inviteId}/decline', { params: { path: { inviteId } } }),
      )
      if (result.response.status === 204) return
      throw toApiError(result)
    },
    "Couldn't decline the invite. Try again.",
    () => {},
  )
}
