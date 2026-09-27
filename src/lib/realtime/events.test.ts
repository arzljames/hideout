import { z } from 'zod'
import contract from './events.schema.json'
import {
  channelEventSchemas,
  parseChannelEvent,
  parseRoomEvent,
  parseUserEvent,
  realtimeTopics,
  roomEventSchemas,
  userEventSchemas,
} from './events'

interface EventDefinition {
  properties?: Record<string, unknown>
  required?: string[]
}

const serverEvents = contract.serverEvents as Record<string, Record<string, EventDefinition>>

function requiredKeys(schema: z.ZodType): string[] {
  if (!(schema instanceof z.ZodObject)) throw new Error('expected an object schema')
  return Object.entries(schema.shape as Record<string, z.ZodType>)
    .filter(([, field]) => !field.safeParse(undefined).success)
    .map(([key]) => key)
    .sort()
}

describe('handled events match the pinned contract (events.schema.json)', () => {
  const handled = {
    room: roomEventSchemas,
    channel: channelEventSchemas,
    user: userEventSchemas,
  } as const

  for (const [topic, schemas] of Object.entries(handled)) {
    for (const [event, schema] of Object.entries(schemas)) {
      it(`${event} is a server event on ${topic}:<id> with the same required keys`, () => {
        const definition = serverEvents[topic]?.[event]
        expect(definition, `${event} missing under serverEvents.${topic}`).toBeDefined()
        expect(requiredKeys(schema)).toEqual([...(definition!.required ?? [])].sort())
        // Every key we read is one the contract defines.
        const shape = (schema as z.ZodObject).shape as Record<string, unknown>
        for (const key of Object.keys(shape)) {
          expect(definition!.properties ?? {}).toHaveProperty(key)
        }
      })
    }
  }

  it('the Channel inside channel:created / channel:updated matches $defs.Channel', () => {
    const channelDefinition = (contract.$defs as Record<string, EventDefinition>).Channel!
    for (const event of ['channel:created', 'channel:updated'] as const) {
      expect(serverEvents.room?.[event]?.properties?.channel).toEqual({ $ref: '#/$defs/Channel' })
      const channel = (roomEventSchemas[event] as z.ZodObject).shape.channel as z.ZodType
      expect(requiredKeys(channel)).toEqual([...(channelDefinition.required ?? [])].sort())
      for (const key of Object.keys((channel as z.ZodObject).shape)) {
        expect(channelDefinition.properties ?? {}).toHaveProperty(key)
      }
    }
  })

  it('the Message inside message:created / message:updated matches $defs.Message and ProfileSummary', () => {
    const defs = contract.$defs as Record<string, EventDefinition>
    const messageDefinition = defs.Message!
    const profileDefinition = defs.ProfileSummary!
    expect(messageDefinition.properties?.author).toEqual({
      anyOf: [{ $ref: '#/$defs/ProfileSummary' }, { type: 'null' }],
    })
    for (const event of ['message:created', 'message:updated'] as const) {
      expect(serverEvents.channel?.[event]?.properties?.message).toEqual({ $ref: '#/$defs/Message' })
      const message = (channelEventSchemas[event] as z.ZodObject).shape.message as z.ZodObject
      expect(requiredKeys(message)).toEqual([...(messageDefinition.required ?? [])].sort())
      for (const key of Object.keys(message.shape)) {
        expect(messageDefinition.properties ?? {}).toHaveProperty(key)
      }
      // author is ProfileSummary | null: check the object inside the nullable.
      const author = (message.shape.author as z.ZodNullable<z.ZodObject>).unwrap()
      expect(requiredKeys(author)).toEqual([...(profileDefinition.required ?? [])].sort())
      for (const key of Object.keys(author.shape)) {
        expect(profileDefinition.properties ?? {}).toHaveProperty(key)
      }
    }
  })

  it('the topics we join are private', () => {
    expect(contract.topics.room.private).toBe(true)
    expect(contract.topics.channel.private).toBe(true)
    expect(contract.topics.user.private).toBe(true)
  })
})

const ROOM_ID = '0b7a3c1e-2f4d-4e5a-8b6c-7d8e9f0a1b2c'
const room = {
  id: ROOM_ID,
  name: 'Night Owls',
  icon: { kind: 'emoji', emoji: 'owl' },
  createdAt: '2026-09-01T10:00:00.000Z',
}

describe('parseRoomEvent', () => {
  it('parses room:updated and room:deleted', () => {
    expect(parseRoomEvent('room:updated', { room })).toEqual({
      event: 'room:updated',
      data: { room },
    })
    expect(parseRoomEvent('room:deleted', { id: ROOM_ID })).toEqual({
      event: 'room:deleted',
      data: { id: ROOM_ID },
    })
  })

  const CHANNEL_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
  const channel = { id: CHANNEL_ID, roomId: ROOM_ID, type: 'text', name: 'general', position: 0 }

  it('parses the channel events', () => {
    expect(parseRoomEvent('channel:created', { channel })).toEqual({
      event: 'channel:created',
      data: { channel },
    })
    expect(parseRoomEvent('channel:updated', { channel })?.data).toEqual({ channel })
    expect(
      parseRoomEvent('channel:reordered', { roomId: ROOM_ID, type: 'voice', channelIds: [CHANNEL_ID] })
        ?.data,
    ).toEqual({ roomId: ROOM_ID, type: 'voice', channelIds: [CHANNEL_ID] })
    expect(parseRoomEvent('channel:deleted', { id: CHANNEL_ID, roomId: ROOM_ID })?.data).toEqual({
      id: CHANNEL_ID,
      roomId: ROOM_ID,
    })
  })

  it('drops invalid channel payloads', () => {
    expect(parseRoomEvent('channel:created', { channel: { ...channel, type: 'stage' } })).toBeNull()
    expect(parseRoomEvent('channel:updated', { channel: { ...channel, position: 1.5 } })).toBeNull()
    expect(parseRoomEvent('channel:updated', { channel: { ...channel, name: undefined } })).toBeNull()
    expect(
      parseRoomEvent('channel:reordered', { roomId: ROOM_ID, type: 'text', channelIds: ['x'] }),
    ).toBeNull()
    expect(parseRoomEvent('channel:reordered', { roomId: ROOM_ID, channelIds: [] })).toBeNull()
    expect(parseRoomEvent('channel:deleted', { id: CHANNEL_ID })).toBeNull()
  })

  it('bounds channel names (1–32) and reorder lists (50 ids), rejecting rather than truncating', () => {
    const named = (name: string) => parseRoomEvent('channel:updated', { channel: { ...channel, name } })
    expect(named('a'.repeat(32))?.data).toEqual({ channel: { ...channel, name: 'a'.repeat(32) } })
    expect(named('a'.repeat(33))).toBeNull()
    expect(named('')).toBeNull()
    expect(parseRoomEvent('channel:created', { channel: { ...channel, name: 'x'.repeat(10_000) } })).toBeNull()

    const reordered = (count: number) =>
      parseRoomEvent('channel:reordered', {
        roomId: ROOM_ID,
        type: 'text',
        channelIds: Array.from({ length: count }, () => CHANNEL_ID),
      })
    expect(reordered(50)).not.toBeNull()
    expect(reordered(51)).toBeNull()
  })

  it('drops invalid payloads and unknown events', () => {
    expect(parseRoomEvent('room:updated', { room: { ...room, id: 'nope' } })).toBeNull()
    expect(parseRoomEvent('room:updated', { room: { ...room, icon: { kind: 'image', url: 'http://x.test/a.png' } } })).toBeNull()
    expect(parseRoomEvent('room:deleted', {})).toBeNull()
    expect(parseRoomEvent('member:joined', { member: {} })).toBeNull()
    expect(parseRoomEvent('toString', {})).toBeNull()
  })
})

describe('parseUserEvent', () => {
  it('parses member:removed (banned optional) and session:expired', () => {
    expect(parseUserEvent('member:removed', { roomId: ROOM_ID })?.data).toEqual({ roomId: ROOM_ID })
    expect(parseUserEvent('member:removed', { roomId: ROOM_ID, banned: true })?.data).toEqual({
      roomId: ROOM_ID,
      banned: true,
    })
    expect(parseUserEvent('session:expired', {})).toEqual({ event: 'session:expired', data: {} })
  })

  it('drops invalid payloads and events other features own', () => {
    expect(parseUserEvent('member:removed', { roomId: 42 })).toBeNull()
    expect(parseUserEvent('session:expired', null)).toBeNull()
    expect(parseUserEvent('invite:revoked', { inviteId: ROOM_ID })).toBeNull()
  })
})

describe('parseChannelEvent', () => {
  const CHANNEL_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
  const message = {
    id: 'f0000000-0000-4000-8000-000000000001',
    channelId: CHANNEL_ID,
    author: { id: ROOM_ID, displayName: 'Maya', avatarUrl: 'https://avatars.test/maya.jpg' },
    body: 'gg, one more?',
    createdAt: '2026-09-01T10:00:00.000Z',
    editedAt: null,
  }

  it('parses message:created, message:updated and message:deleted', () => {
    expect(parseChannelEvent('message:created', { message })).toEqual({
      event: 'message:created',
      data: { message },
    })
    const edited = { ...message, body: 'gg', editedAt: '2026-09-01T10:01:00.000Z' }
    expect(parseChannelEvent('message:updated', { message: edited })?.data).toEqual({ message: edited })
    expect(
      parseChannelEvent('message:deleted', { id: message.id, channelId: CHANNEL_ID }),
    ).toEqual({ event: 'message:deleted', data: { id: message.id, channelId: CHANNEL_ID } })
  })

  it('accepts a deleted author (null) and a missing avatar', () => {
    expect(parseChannelEvent('message:created', { message: { ...message, author: null } })).not.toBeNull()
    const noAvatar = { ...message, author: { ...message.author, avatarUrl: null } }
    expect(parseChannelEvent('message:created', { message: noAvatar })).not.toBeNull()
  })

  it('bounds the body at 2000 code points, counting an emoji once, and rejects longer', () => {
    const emoji = String.fromCodePoint(0x1f3ae)
    expect(emoji).toHaveLength(2)
    const body = (text: string) => parseChannelEvent('message:created', { message: { ...message, body: text } })
    expect(body(emoji.repeat(2000))).not.toBeNull()
    expect(body(emoji.repeat(2001))).toBeNull()
    expect(body('a'.repeat(2000))).not.toBeNull()
    expect(body('a'.repeat(2001))).toBeNull()
  })

  it('drops invalid payloads and events it does not handle', () => {
    expect(parseChannelEvent('message:created', { message: { ...message, id: 'nope' } })).toBeNull()
    expect(parseChannelEvent('message:created', { message: { ...message, body: 42 } })).toBeNull()
    expect(parseChannelEvent('message:created', { message: { ...message, createdAt: 'yesterday' } })).toBeNull()
    expect(parseChannelEvent('message:created', { message: { ...message, editedAt: undefined } })).toBeNull()
    expect(
      parseChannelEvent('message:created', {
        message: { ...message, author: { ...message.author, avatarUrl: 'javascript:alert(1)' } },
      }),
    ).toBeNull()
    expect(parseChannelEvent('message:updated', {})).toBeNull()
    expect(parseChannelEvent('message:deleted', { id: message.id })).toBeNull()
    expect(parseChannelEvent('typing:started', { userId: ROOM_ID })).toBeNull()
    expect(parseChannelEvent('hasOwnProperty', {})).toBeNull()
  })
})

it('builds lowercase topic names', () => {
  expect(realtimeTopics.room('0B7A3C1E-2F4D-4E5A-8B6C-7D8E9F0A1B2C')).toBe(`room:${ROOM_ID}`)
  expect(realtimeTopics.channel('0B7A3C1E-2F4D-4E5A-8B6C-7D8E9F0A1B2C')).toBe(`channel:${ROOM_ID}`)
  expect(realtimeTopics.user('ABC')).toBe('user:abc')
})
