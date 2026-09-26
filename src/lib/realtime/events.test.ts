import { z } from 'zod'
import contract from './events.schema.json'
import {
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
  const handled = { room: roomEventSchemas, user: userEventSchemas } as const

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

  it('both topics are private', () => {
    expect(contract.topics.room.private).toBe(true)
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

it('builds lowercase topic names', () => {
  expect(realtimeTopics.room('0B7A3C1E-2F4D-4E5A-8B6C-7D8E9F0A1B2C')).toBe(`room:${ROOM_ID}`)
  expect(realtimeTopics.user('ABC')).toBe('user:abc')
})
