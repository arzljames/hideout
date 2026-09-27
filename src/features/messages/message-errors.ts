import { OFFLINE_MESSAGE } from '@/features/rooms'
import { ApiError } from '@/lib/api/client'

export const MESSAGE_ERRORS = {
  offline: OFFLINE_MESSAGE,
  rateLimited: "You're sending too fast. Wait a moment and try again.",
  server: 'Something went wrong on our side. Try again.',
  channelGone: "This channel isn't available anymore.",
  notText: 'This is a voice channel.',
  forbidden: "Hideout couldn't verify this request. Reload the page and try again.",
  sendFailed: "Couldn't send the message. Try again.",
  editForbidden: 'You can only edit your own messages.',
  editGone: 'That message was deleted.',
  editFailed: "Couldn't save your edit. Try again.",
  deleteForbidden: "You can't delete this message.",
  deleteFailed: "Couldn't delete the message. Try again.",
  loadRateLimited: 'Too many requests. Wait a moment and try again.',
} as const

/** Offline, rate limited, or a server error: worth retrying automatically. */
export function isTransientError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'NETWORK' || error.status === 429 || error.status >= 500)
  )
}

export function isOfflineError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'NETWORK'
}

/** A 422's message for the body field (`body.body`, or `body`), if any. */
export function bodyFieldMessage(error: unknown): string | undefined {
  if (!(error instanceof ApiError) || error.status !== 422) return undefined
  const detail = error.details?.find((item) => item.path === 'body.body' || item.path === 'body')
  return detail?.message ?? error.message
}

/** Copy for a failed edit or delete that has no dedicated handling. */
export function messageWriteErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  if (error.code === 'NETWORK') return MESSAGE_ERRORS.offline
  if (error.status === 429) return MESSAGE_ERRORS.rateLimited
  return fallback
}

/** "Messages didn't load" description for a failed history request. */
export function messagesLoadErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return MESSAGE_ERRORS.server
  if (error.code === 'NETWORK') return MESSAGE_ERRORS.offline
  if (error.status === 404) return MESSAGE_ERRORS.channelGone
  if (error.status === 409) return MESSAGE_ERRORS.notText
  if (error.status === 429) return MESSAGE_ERRORS.loadRateLimited
  return MESSAGE_ERRORS.server
}
