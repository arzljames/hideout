import type { ChatMessage } from '../sample-messages'

/** Consecutive messages from one author within this window share a header. */
const GROUP_WINDOW_MS = 7 * 60 * 1000

export interface MessageGroupData {
  id: string
  author: ChatMessage['author']
  sentAt: string
  messages: ChatMessage[]
}

export interface MessageDay {
  /** Local date key, e.g. "2026-09-24". */
  key: string
  sentAt: string
  groups: MessageGroupData[]
}

function localDayKey(iso: string): string {
  const date = new Date(iso)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Split messages (oldest first) into days, then into author groups. */
export function groupMessages(messages: ChatMessage[]): MessageDay[] {
  const days: MessageDay[] = []

  for (const message of messages) {
    const key = localDayKey(message.sentAt)
    let day = days.at(-1)
    if (!day || day.key !== key) {
      day = { key, sentAt: message.sentAt, groups: [] }
      days.push(day)
    }

    const group = day.groups.at(-1)
    const lastInGroup = group?.messages.at(-1)
    const sameAuthor = group?.author.id === message.author.id
    const withinWindow =
      lastInGroup !== undefined &&
      new Date(message.sentAt).getTime() - new Date(lastInGroup.sentAt).getTime() <= GROUP_WINDOW_MS

    if (group && sameAuthor && withinWindow) {
      group.messages.push(message)
    } else {
      day.groups.push({
        id: message.id,
        author: message.author,
        sentAt: message.sentAt,
        messages: [message],
      })
    }
  }

  return days
}
