// TODO(api): replace with the messages query + Realtime inserts. These are presentational
// shapes only; the contract row type belongs in ./types.ts (reserved), don't grow this one.

import type { ComponentProps } from 'react'
import type { UserAvatar } from '@/components/user-avatar'

type PersonaTone = ComponentProps<typeof UserAvatar>['tone']

/** One message as the message list renders it. */
export interface ChatMessage {
  id: string
  author: {
    id: string
    name: string
    tone?: PersonaTone
  }
  /** ISO 8601. */
  sentAt: string
  text: string
  edited?: boolean
}

function todayAt(hours: number, minutes: number): string {
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

const maya = { id: 'maya', name: 'Maya', tone: 'persona-1' } as const
const alex = { id: 'alex', name: 'Alex', tone: 'persona-1' } as const
const jun = { id: 'jun', name: 'Jun', tone: 'persona-2' } as const
const arzl = { id: 'arzl', name: 'Arzl', tone: 'persona-3' } as const

/** The signed-in user's id, for "own message" actions. TODO(api): from meQueryOptions. */
export const sampleViewerId = 'arzl'

const general: ChatMessage[] = [
  { id: 'm1', author: maya, sentAt: todayAt(21, 41), text: 'Anyone up for a couple of runs after dinner?' },
  { id: 'm2', author: maya, sentAt: todayAt(21, 41), text: 'I still need the bell bearing from the catacombs.' },
  { id: 'm3', author: alex, sentAt: todayAt(21, 44), text: 'In. Give me 20 minutes.' },
  {
    id: 'm4',
    author: alex,
    sentAt: todayAt(21, 44),
    text: 'This is the route I was talking about: https://steamcommunity.com/sharedfiles/filedetails/?id=2951',
  },
  { id: 'm5', author: jun, sentAt: todayAt(21, 52), text: 'Just wrapped a deep dive. Hopping in voice.' },
  { id: 'm6', author: arzl, sentAt: todayAt(21, 53), text: 'Same, joining now 🦉', edited: true },
]

/** Messages by `${roomId}/${channelId}`. Missing keys are empty channels. */
const sampleMessages: Record<string, ChatMessage[]> = {
  'night-owls/general': general,
}

/** Names currently typing, by `${roomId}/${channelId}`. */
const sampleTyping: Record<string, string[]> = {
  'night-owls/general': ['Alex'],
}

export function getSampleMessages(roomId: string, channelId: string): ChatMessage[] {
  return sampleMessages[`${roomId}/${channelId}`] ?? []
}

export function getSampleTyping(roomId: string, channelId: string): string[] {
  return sampleTyping[`${roomId}/${channelId}`] ?? []
}
