import type { Message } from '@/features/messages'
import type { ProfileSummary } from '@/features/rooms'
import { meFixture } from './me'
import { channelOf, nightOwls } from './rooms'

function person(displayName: string): ProfileSummary {
  const member = nightOwls.members.find((item) => item.user.displayName === displayName)
  if (!member) throw new Error(`Night Owls has no member "${displayName}"`)
  return member.user
}

/** Message authors: the signed-in user and Night Owls members. */
export const people = {
  me: { id: meFixture.id, displayName: meFixture.displayName, avatarUrl: meFixture.avatarUrl },
  maya: person('Maya'),
  alex: person('Alex'),
  jun: person('Jun'),
} satisfies Record<string, ProfileSummary>

/** A deterministic message id. */
export function messageId(n: number): string {
  return `f0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

/** Today at hh:mm:ss (local time), as ISO. */
export function todayAt(hours: number, minutes: number, seconds = 0): string {
  const date = new Date()
  date.setHours(hours, minutes, seconds, 0)
  return date.toISOString()
}

let count = 0

/** A message in the contract's shape (by Maya, unless overridden). */
export function makeMessage(overrides: Partial<Message> & Pick<Message, 'channelId'>): Message {
  count += 1
  return {
    id: messageId(1000 + count),
    author: people.maya,
    body: `Message ${count}`,
    createdAt: todayAt(12, 0, count % 60),
    editedAt: null,
    ...overrides,
  }
}

const general = channelOf(nightOwls, 'general').id

/** #general in Night Owls, oldest first. The last one is yours, and edited. */
export const generalMessages: Message[] = [
  {
    id: messageId(1),
    channelId: general,
    author: people.maya,
    body: 'Anyone up for a couple of runs after dinner?',
    createdAt: todayAt(21, 41, 0),
    editedAt: null,
  },
  {
    id: messageId(2),
    channelId: general,
    author: people.maya,
    body: 'I still need the bell bearing from the catacombs.',
    createdAt: todayAt(21, 41, 30),
    editedAt: null,
  },
  {
    id: messageId(3),
    channelId: general,
    author: people.alex,
    body: 'In. Give me 20 minutes.',
    createdAt: todayAt(21, 44, 0),
    editedAt: null,
  },
  {
    id: messageId(4),
    channelId: general,
    author: people.alex,
    body: 'This is the route I was talking about: https://steamcommunity.com/sharedfiles/filedetails/?id=2951',
    createdAt: todayAt(21, 44, 30),
    editedAt: null,
  },
  {
    id: messageId(5),
    channelId: general,
    author: people.jun,
    body: 'Just wrapped a deep dive. Hopping in voice.',
    createdAt: todayAt(21, 52, 0),
    editedAt: null,
  },
  {
    id: messageId(6),
    channelId: general,
    author: people.me,
    body: 'Same, joining now',
    createdAt: todayAt(21, 53, 0),
    editedAt: todayAt(21, 54, 0),
  },
]
