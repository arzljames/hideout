import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { OFFLINE_MESSAGE, setApiFieldErrors } from '@/features/rooms'
import { ApiError } from '@/lib/api/client'
import { TAKEN_CHANNEL_NAME_MESSAGE } from './channel-name-schema'

/** Live channels per room: hideout-api's limit (see POST /api/rooms/{roomId}/channels in schema.gen.ts). */
export const CHANNEL_LIMIT = 50

export const CHANNEL_MESSAGES = {
  nameTaken: TAKEN_CHANNEL_NAME_MESSAGE,
  limitReached: `This room has the maximum of ${CHANNEL_LIMIT} channels.`,
  lastTextChannel: 'A room needs at least one text channel.',
  forbidden: 'Only owners and admins can manage channels.',
  channelGone: "This channel isn't available anymore.",
  orderStale: 'The channel list changed. Try again.',
  rateLimited: 'Too many channel changes. Try again later.',
  offline: OFFLINE_MESSAGE,
} as const

function hasCode(error: unknown, status: number, code: string): error is ApiError {
  return error instanceof ApiError && error.status === status && error.code === code
}

export function isChannelNameTaken(error: unknown): boolean {
  return hasCode(error, 409, 'CHANNEL_NAME_TAKEN')
}

export function isChannelOrderStale(error: unknown): boolean {
  return hasCode(error, 409, 'CHANNEL_ORDER_STALE')
}

export function isLastTextChannel(error: unknown): boolean {
  return hasCode(error, 409, 'LAST_TEXT_CHANNEL')
}

/**
 * Copy for a failed channel write. Field-level cases (CHANNEL_NAME_TAKEN, 422) have messages
 * too, for callers without a form; forms should prefer `setChannelFieldErrors`.
 */
export function channelErrorMessage(
  error: unknown,
  fallback = "Couldn't save the channel. Try again.",
): string {
  if (!(error instanceof ApiError)) return fallback
  if (error.code === 'NETWORK') return CHANNEL_MESSAGES.offline
  switch (error.status) {
    case 403:
      return CHANNEL_MESSAGES.forbidden
    case 404:
      return CHANNEL_MESSAGES.channelGone
    case 409:
      switch (error.code) {
        case 'CHANNEL_NAME_TAKEN':
          return CHANNEL_MESSAGES.nameTaken
        case 'CHANNEL_LIMIT_REACHED':
          return CHANNEL_MESSAGES.limitReached
        case 'LAST_TEXT_CHANNEL':
          return CHANNEL_MESSAGES.lastTextChannel
        case 'CHANNEL_ORDER_STALE':
          return CHANNEL_MESSAGES.orderStale
        default:
          return fallback
      }
    case 422:
      return error.message || fallback
    case 429:
      return CHANNEL_MESSAGES.rateLimited
    default:
      return fallback
  }
}

function channelFieldForPath(path: string): 'name' | 'type' | null {
  if (path === 'body.name' || path === 'name') return 'name'
  if (path === 'body.type' || path === 'type') return 'type'
  return null
}

/**
 * Put CHANNEL_NAME_TAKEN, or a 422's field errors, on a channel form with a `name` field (and
 * optionally `type`). Returns true when a field got an error; otherwise show a form-level
 * message (`channelErrorMessage`).
 */
export function setChannelFieldErrors<T extends FieldValues & { name: string }>(
  setError: UseFormSetError<T>,
  error: unknown,
): boolean {
  if (!(error instanceof ApiError)) return false
  if (isChannelNameTaken(error)) {
    setError('name' as Path<T>, { type: 'server', message: CHANNEL_MESSAGES.nameTaken }, { shouldFocus: true })
    return true
  }
  if (error.status !== 422) return false
  // Only `type` fields that exist on T are ever produced for it: the create form has one, and
  // the rename API never reports a `type` path.
  return setApiFieldErrors(setError, error, (path) => channelFieldForPath(path) as Path<T> | null)
}
