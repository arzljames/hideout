import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  applyMemberJoined,
  applyMemberLeft,
  dropRoom,
  getCachedRoomDetail,
  getCachedRoomName,
  roomKeys,
  roomMutationKeys,
  setCachedMyRole,
  type Member,
  type RoomDetail,
} from '@/features/rooms'
import { api, ApiError, toApiError, withNetworkErrors } from '@/lib/api/client'
import { isolate } from '@/lib/bidi'
import type { ChangeRoleBody } from './types'
import { MEMBER_MESSAGES, memberErrorMessage, useMemberErrorEffects } from './member-errors'

/** Mutation keys, so rows can tell which members have a change in flight. */
export const memberMutationKeys = {
  changeRole: (roomId: string) => ['members', 'change-role', roomId.toLowerCase()] as const,
}

/** Toast the failures every member write shares: 403 always; the rest only when `toastAll`. */
function toastFailure(
  error: unknown,
  outcome: string,
  { toastAll, fallback, memberName }: { toastAll: boolean; fallback: string; memberName?: string },
) {
  if (outcome === 'room-gone') return // The room-gone path toasted.
  if (outcome === 'forbidden') {
    toast.error(MEMBER_MESSAGES.forbidden)
    return
  }
  if (toastAll) toast.error(memberErrorMessage(error, fallback, memberName))
}

/**
 * Leave the room (admins and members; the owner gets 409 OWNER_PROTECTED). 204, or a 404 (not a
 * member anymore), goes Home, forgets the room and toasts. Other failures are left to the
 * caller's dialog (`memberErrorMessage`), except a 403, which is toasted.
 */
export function useLeaveRoom(roomId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const errorEffects = useMemberErrorEffects(roomId)

  return useMutation({
    mutationKey: roomMutationKeys.leave(roomId),
    mutationFn: async (): Promise<void> => {
      const result = await withNetworkErrors(() =>
        api.DELETE('/api/rooms/{roomId}/members/me', { params: { path: { roomId } } }),
      )
      if (result.response.status === 204 || result.response.status === 404) return
      throw toApiError(result)
    },
    onSuccess: async () => {
      const name = getCachedRoomName(queryClient, roomId)
      // Navigate first, so the mounted room screen doesn't refetch the room once it's dropped.
      await navigate({ to: '/', replace: true })
      dropRoom(queryClient, roomId)
      toast.success(name ? `You left ${isolate(name)}` : 'You left the room')
    },
    onError: async (error) => {
      const outcome = await errorEffects(error)
      toastFailure(error, outcome, { toastAll: false, fallback: '' })
    },
  })
}

/**
 * Remove someone from the room (owner: anyone else; admin: plain members), optimistically: the
 * member disappears from the cached room at once. 204, or a 404 (already gone), is done; a 404
 * also rechecks the room. Failures put the member back; a 403 is toasted, the rest are left to
 * the confirmation dialog (`memberErrorMessage`).
 */
export function useRemoveMember(roomId: string) {
  const queryClient = useQueryClient()
  const errorEffects = useMemberErrorEffects(roomId)

  return useMutation({
    mutationFn: async (member: Member): Promise<'removed' | 'not-found'> => {
      const result = await withNetworkErrors(() =>
        api.DELETE('/api/rooms/{roomId}/members/{userId}', {
          params: { path: { roomId, userId: member.user.id } },
        }),
      )
      if (result.response.status === 204) return 'removed'
      if (result.response.status === 404) return 'not-found'
      throw toApiError(result)
    },
    onMutate: async (member) => {
      // A room refetch landing now would bring the member back.
      await queryClient.cancelQueries({ queryKey: roomKeys.detail(roomId), exact: true })
      applyMemberLeft(queryClient, roomId, { userId: member.user.id })
    },
    onSuccess: async (status, member) => {
      // A 404: the member was already gone, or the room is gone for us. Recheck first; if the
      // room is gone, the room-gone path has toasted, so don't claim a removal too.
      if (status === 'not-found') {
        const outcome = await errorEffects(new ApiError(404, 'NOT_FOUND', 'Member not found.'))
        if (outcome === 'room-gone') return
      }
      toast.success(`Removed ${isolate(member.user.displayName)}`)
    },
    onError: async (error, member) => {
      // Put them back (in role order) unless the room isn't cached anymore.
      if (getCachedRoomDetail(queryClient, roomId)) applyMemberJoined(queryClient, roomId, { member })
      const outcome = await errorEffects(error)
      toastFailure(error, outcome, { toastAll: false, fallback: '' })
    },
  })
}

export interface ChangeRoleVariables {
  member: Member
  role: ChangeRoleBody['role']
}

/**
 * Make a member an admin or an admin a plain member (owner only). The response replaces the
 * member (regrouped by role). Failures are toasted; after a 5xx the room is refetched before
 * the mutation settles, so a retry starts from the server's state.
 */
export function useChangeRole(roomId: string) {
  const queryClient = useQueryClient()
  const errorEffects = useMemberErrorEffects(roomId)

  return useMutation({
    mutationKey: memberMutationKeys.changeRole(roomId),
    mutationFn: async ({ member, role }: ChangeRoleVariables): Promise<Member> => {
      const result = await withNetworkErrors(() =>
        api.PATCH('/api/rooms/{roomId}/members/{userId}', {
          params: { path: { roomId, userId: member.user.id } },
          body: { role },
        }),
      )
      if (result.data) return result.data
      throw toApiError(result)
    },
    onSuccess: (member) => {
      applyMemberJoined(queryClient, roomId, { member })
      const name = isolate(member.user.displayName)
      toast.success(member.role === 'admin' ? `${name} is now an admin` : `${name} is no longer an admin`)
    },
    onError: async (error, { member, role }) => {
      const outcome = await errorEffects(error)
      toastFailure(error, outcome, {
        toastAll: true,
        fallback:
          role === 'admin'
            ? `Couldn't make ${isolate(member.user.displayName)} an admin. Try again.`
            : `Couldn't remove ${isolate(member.user.displayName)} as admin. Try again.`,
        memberName: member.user.displayName,
      })
    },
  })
}

/**
 * Make another member the owner (owner only); the caller becomes an admin, so owner-only
 * controls disappear. The response is the room as the caller now sees it. Failures are left to
 * the caller's dialog, except a 403 (toasted); after a 5xx the room is refetched first.
 */
export function useTransferOwnership(roomId: string) {
  const queryClient = useQueryClient()
  const errorEffects = useMemberErrorEffects(roomId)

  return useMutation({
    mutationFn: async (member: Member): Promise<RoomDetail> => {
      const result = await withNetworkErrors(() =>
        api.POST('/api/rooms/{roomId}/transfer-ownership', {
          params: { path: { roomId } },
          body: { userId: member.user.id },
        }),
      )
      if (result.data) return result.data
      throw toApiError(result)
    },
    onSuccess: (detail, member) => {
      queryClient.setQueryData(roomKeys.detail(roomId), detail)
      setCachedMyRole(queryClient, roomId, detail.myRole)
      toast.success(`${isolate(member.user.displayName)} is now the owner. You're an admin.`)
    },
    onError: async (error) => {
      const outcome = await errorEffects(error)
      toastFailure(error, outcome, { toastAll: false, fallback: '' })
    },
  })
}
