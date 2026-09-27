import type { Message } from '../types'

export const DELETED_AUTHOR_NAME = 'Deleted user'

/** The author's display name, or "Deleted user" when their profile was deleted. */
export function authorName(message: Pick<Message, 'author'>): string {
  return message.author?.displayName ?? DELETED_AUTHOR_NAME
}
