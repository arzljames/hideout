import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import {
  isRoomNotFound,
  OFFLINE_MESSAGE,
  roomKeys,
  roomQueryOptions,
  useRoomGone,
} from '@/features/rooms'
import { ApiError } from '@/lib/api/client'
import { isolate } from '@/lib/bidi'

export const MEMBER_MESSAGES = {
  ownerProtected:
    "The owner can't leave or be removed. Transfer ownership or delete the room first.",
  forbidden: "You can't do that in this room anymore.",
  rateLimited: 'Too many member changes. Try again later.',
  serverError: 'Something went wrong. The member list was refreshed; check it and try again.',
  offline: OFFLINE_MESSAGE,
} as const

/** What a failed member write meant for the room, beyond its message. */
export type MemberErrorOutcome =
  /** 403: the user can't do this (anymore). Toasted; the room is being refetched. */
  | 'forbidden'
  /** The room is gone for us: the room-gone path navigated away, dropped and toasted. */
  | 'room-gone'
  /** 404 but the room is still there: the target isn't a member anymore (the refetch shows it). */
  | 'member-gone'
  /** 5xx: the change may have applied; the room was refetched, so a retry sees the truth. */
  | 'refetched'
  /** Anything else (offline, 409, 422, 429): nothing to do beyond showing the message. */
  | 'none'

// The outcome a mutation's onError worked out, so a dialog's own onError can read it.
const outcomes = new WeakMap<object, MemberErrorOutcome>()

export function memberErrorOutcome(error: unknown): MemberErrorOutcome {
  return (typeof error === 'object' && error !== null && outcomes.get(error)) || 'none'
}

export function isOwnerProtected(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && error.code === 'OWNER_PROTECTED'
}

/**
 * Copy for a failed member write. `memberName` (plain text, isolated here) names the target for
 * a 404; `fallback` is the action-specific "Couldn't … Try again."
 */
export function memberErrorMessage(
  error: unknown,
  fallback: string,
  memberName?: string,
): string {
  if (!(error instanceof ApiError)) return fallback
  if (error.code === 'NETWORK') return MEMBER_MESSAGES.offline
  if (isOwnerProtected(error)) return MEMBER_MESSAGES.ownerProtected
  if (error.status >= 500) return MEMBER_MESSAGES.serverError
  switch (error.status) {
    case 403:
      return MEMBER_MESSAGES.forbidden
    case 404:
      return memberName
        ? `${isolate(memberName)} isn't in this room anymore.`
        : "That member isn't in this room anymore."
    case 422:
      return error.message || fallback
    case 429:
      return MEMBER_MESSAGES.rateLimited
    default:
      return fallback
  }
}

/**
 * Side effects shared by every member write's failure, run (and awaited) in the mutation's
 * onError so `isPending` lasts until they're done:
 * - 403 refetches the room, so the role and the controls catch up;
 * - 404 and 5xx recheck the room (a 5xx may have applied the change, so no retry before the
 *   refetch); if the room itself 404s, take the room-gone path.
 * The outcome is remembered for `memberErrorOutcome(error)`.
 */
export function useMemberErrorEffects(roomId: string) {
  const queryClient = useQueryClient()
  const roomGone = useRoomGone()

  return useCallback(
    async (error: unknown): Promise<MemberErrorOutcome> => {
      const outcome = await (async (): Promise<MemberErrorOutcome> => {
        if (!(error instanceof ApiError) || error.code === 'NETWORK') return 'none'
        if (error.status === 403) {
          void queryClient.invalidateQueries({ queryKey: roomKeys.detail(roomId), exact: true })
          return 'forbidden'
        }
        if (error.status !== 404 && error.status < 500) return 'none'
        const settled: MemberErrorOutcome = error.status === 404 ? 'member-gone' : 'refetched'
        try {
          await queryClient.fetchQuery({ ...roomQueryOptions(roomId), staleTime: 0 })
          return settled
        } catch (recheckError) {
          if (isRoomNotFound(recheckError)) {
            await roomGone(roomId, 'removed')
            return 'room-gone'
          }
          // Couldn't recheck (e.g. offline): show the original error.
          return settled
        }
      })()
      if (typeof error === 'object' && error !== null) outcomes.set(error, outcome)
      return outcome
    },
    [queryClient, roomGone, roomId],
  )
}
