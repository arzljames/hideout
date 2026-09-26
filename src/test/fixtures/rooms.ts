import type { Channel, Member, MyRoom, Role, RoomDetail } from '@/features/rooms'
import { meFixture } from './me'

/** A deterministic UUID: `kind` picks the block (rooms, channels, users), `n` the item. */
function uuid(kind: 'a' | 'c' | 'e', n: number): string {
  return `${kind}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

const people = {
  arzl: { id: meFixture.id, displayName: meFixture.displayName, avatarUrl: null },
  maya: { id: uuid('e', 1), displayName: 'Maya', avatarUrl: 'https://avatars.example/maya.jpg' },
  jun: { id: uuid('e', 2), displayName: 'Jun', avatarUrl: null },
  alex: { id: uuid('e', 3), displayName: 'Alex', avatarUrl: null },
  priya: { id: uuid('e', 4), displayName: 'Priya', avatarUrl: null },
  theo: { id: uuid('e', 5), displayName: 'Theo', avatarUrl: null },
  sam: { id: uuid('e', 6), displayName: 'Sam', avatarUrl: null },
}

type Person = keyof typeof people

let channelCount = 0

function channels(roomId: string, text: string[], voice: string[]): Channel[] {
  return [
    ...text.map((name, position) => ({
      id: uuid('c', ++channelCount),
      roomId,
      type: 'text' as const,
      name,
      position,
    })),
    ...voice.map((name, position) => ({
      id: uuid('c', ++channelCount),
      roomId,
      type: 'voice' as const,
      name,
      position,
    })),
  ]
}

function members(roomId: string, entries: [Person, Role][]): Member[] {
  return entries.map(([person, role], index) => ({
    roomId,
    user: people[person],
    role,
    joinedAt: `2026-0${3 + Math.min(index, 6)}-15T12:00:00.000Z`,
    currentGame: null,
  }))
}

interface RoomSpec {
  n: number
  name: string
  emoji: string
  text: string[]
  voice: string[]
  /** Owner first, then admins, then members, each by name (the API's order). */
  members: [Person, Role][]
}

function room({ n, name, emoji, text, voice, members: entries }: RoomSpec): RoomDetail {
  const id = uuid('a', n)
  const roomChannels = channels(id, text, voice)
  const viewer = entries.find(([person]) => person === 'arzl')
  if (!viewer) throw new Error(`${name}: the viewer must be a member`)
  return {
    room: { id, name, icon: { kind: 'emoji', emoji }, createdAt: '2026-03-01T12:00:00.000Z' },
    myRole: viewer[1],
    defaultChannelId: roomChannels.find((channel) => channel.type === 'text')?.id ?? null,
    channels: roomChannels,
    members: members(id, entries),
  }
}

/** You own it; 7 members. */
export const nightOwls = room({
  n: 1,
  name: 'Night Owls',
  emoji: '🦉',
  text: ['general', 'clips', 'planning'],
  voice: ['voice', 'late night'],
  members: [
    ['arzl', 'owner'],
    ['maya', 'admin'],
    ['alex', 'member'],
    ['jun', 'member'],
    ['priya', 'member'],
    ['sam', 'member'],
    ['theo', 'member'],
  ],
})

/** You're an admin. */
export const raidNight = room({
  n: 2,
  name: 'Raid Night',
  emoji: '⚔️',
  text: ['lobby', 'strats'],
  voice: ['raid'],
  members: [
    ['theo', 'owner'],
    ['arzl', 'admin'],
  ],
})

/** You're a plain member. */
export const rockAndStone = room({
  n: 3,
  name: 'Rock and Stone',
  emoji: '⛏️',
  text: ['general'],
  voice: ['mission control'],
  members: [
    ['maya', 'owner'],
    ['arzl', 'member'],
  ],
})

/** You're a plain member. */
export const pitLane = room({
  n: 4,
  name: 'Pit Lane',
  emoji: '🏎️',
  text: ['paddock'],
  voice: ['grid'],
  members: [
    ['jun', 'owner'],
    ['arzl', 'member'],
  ],
})

/** Every room the signed-in user is in, oldest membership first. */
export const roomFixtures: RoomDetail[] = [nightOwls, raidNight, rockAndStone, pitLane]

/** A room id that no fixture uses: the API answers 404. */
export const missingRoomId = uuid('a', 999)

/** The list entry `GET /api/rooms` returns for a room. */
export function toMyRoom(detail: RoomDetail): MyRoom {
  return { room: detail.room, myRole: detail.myRole, joinedAt: '2026-03-15T12:00:00.000Z' }
}

/** A room's channel by name. Throws for a name the fixture doesn't have. */
export function channelOf(detail: RoomDetail, name: string): Channel {
  const channel = detail.channels.find((item) => item.name === name)
  if (!channel) throw new Error(`${detail.room.name} has no channel "${name}"`)
  return channel
}

/** `/rooms/<id>`, or `/rooms/<id>/<channel id>` for a channel given by name. */
export function roomPath(detail: RoomDetail, channelName?: string): string {
  const base = `/rooms/${detail.room.id}`
  return channelName ? `${base}/${channelOf(detail, channelName).id}` : base
}
