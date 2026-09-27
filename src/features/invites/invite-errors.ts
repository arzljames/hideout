import { OFFLINE_MESSAGE } from '@/features/rooms'
import { ApiError } from '@/lib/api/client'

/** Copy for the invite error codes in the hideout-api contract. */
const CODE_MESSAGES: Record<string, string> = {
  ALREADY_MEMBER: "They're already in this room.",
  INVITE_ALREADY_PENDING: "You've already invited them.",
  USER_BANNED: 'That person is banned from this room.',
  BANNED: "You're banned from this room.",
  INVITE_EXPIRED: 'This invite has expired.',
  INVITE_REVOKED: 'This invite was revoked.',
  INVITE_USED_UP: 'This invite has reached its limit.',
  INVITE_ALREADY_RESPONDED: "You've already responded to this invite.",
}

export const RATE_LIMITED_MESSAGE = 'Too many tries. Wait a minute and try again.'
export const INVITE_UNAVAILABLE_MESSAGE = "This invite isn't available anymore."

/** What went wrong with an invite request, in words; `fallback` for anything unexpected. */
export function inviteErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  const known = CODE_MESSAGES[error.code]
  if (known) return known
  if (error.code === 'NETWORK') return OFFLINE_MESSAGE
  if (error.status === 404) return INVITE_UNAVAILABLE_MESSAGE
  if (error.status === 429) return RATE_LIMITED_MESSAGE
  if (error.status === 403) return "You don't have permission to do that."
  if (error.status === 422) return error.message || fallback
  return fallback
}

/** The invite can't be used anymore (gone, answered, expired, revoked): drop it from lists. */
export function isInviteGone(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 404 ||
      error.status === 410 ||
      (error.status === 409 && error.code === 'INVITE_ALREADY_RESPONDED'))
  )
}
