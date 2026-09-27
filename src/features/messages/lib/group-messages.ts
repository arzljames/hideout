import type { Message } from '../types'

/** Consecutive messages from one author within this window share a header. */
const GROUP_WINDOW_MS = 7 * 60 * 1000

/** One row of the virtualized message log. */
export type MessageLogRow =
  | { kind: 'day'; key: string; createdAt: string }
  | { kind: 'message'; key: string; message: Message; isFirst: boolean }

function localDayKey(iso: string): string {
  const date = new Date(iso)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function authorKey(message: Message): string | null {
  return message.author?.id.toLowerCase() ?? null
}

/**
 * Rows for messages (oldest first): a divider at each new local day, then messages, where
 * `isFirst` starts an author group (a new author, a deleted author, or a gap over 7 minutes).
 */
export function toLogRows(messages: readonly Message[]): MessageLogRow[] {
  const rows: MessageLogRow[] = []
  let previous: Message | undefined
  let previousDay: string | undefined

  for (const message of messages) {
    const day = localDayKey(message.createdAt)
    if (day !== previousDay) {
      rows.push({ kind: 'day', key: `day-${day}`, createdAt: message.createdAt })
      previousDay = day
      previous = undefined
    }
    const author = authorKey(message)
    const continues =
      previous !== undefined &&
      author !== null &&
      authorKey(previous) === author &&
      Date.parse(message.createdAt) - Date.parse(previous.createdAt) <= GROUP_WINDOW_MS
    rows.push({ kind: 'message', key: message.id.toLowerCase(), message, isFirst: !continues })
    previous = message
  }

  return rows
}
