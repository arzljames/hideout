import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '@/lib/api/client'
import { OFFLINE_MESSAGE } from './api'
import type { RoomEmoji } from './room-emojis'

/** The fields shared by Create room and the Room settings Overview. */
interface RoomFormValues {
  name: string
  emoji: RoomEmoji
}

/** Which form field a 422 detail path (e.g. `body.name`, `body.icon.emoji`) belongs to. */
function fieldForPath(path: string): keyof RoomFormValues | null {
  if (path === 'body.name' || path === 'name') return 'name'
  if (/^(body\.)?icon(\.|$)/.test(path)) return 'emoji'
  return null
}

/**
 * Put a 422's field errors on a form, using `fieldForPath` to map each detail path (e.g.
 * `body.name`) to a field. The first mapped field gets focus. Returns true when at least one
 * field got an error, so the caller can fall back to a form-level message otherwise.
 */
export function setApiFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  error: ApiError,
  fieldForPath: (path: string) => Path<T> | null,
): boolean {
  let focused = false
  for (const detail of error.details ?? []) {
    const field = fieldForPath(detail.path)
    if (!field) continue
    setError(field, { type: 'server', message: detail.message }, { shouldFocus: !focused })
    focused = true
  }
  return focused
}

/**
 * Put a 422's field errors on the form. Returns true when at least one field got an error, so
 * the caller can fall back to a form-level message otherwise.
 */
export function setRoomFieldErrors<T extends RoomFormValues>(
  setError: UseFormSetError<T>,
  error: ApiError,
): boolean {
  // The generic keeps callers' own form types; both fields exist on every T.
  const set = setError as unknown as UseFormSetError<RoomFormValues>
  return setApiFieldErrors(set, error, fieldForPath)
}

/** Form-level copy for a failed room write that isn't a field error. */
export function roomFormErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  if (error.code === 'NETWORK') return OFFLINE_MESSAGE
  if (error.status === 422) return error.message || fallback
  return fallback
}
