import { z } from 'zod'
import type { components } from '@/lib/api/schema.gen'

/*
 * Realtime events this app handles, validated with Zod. hideout-api delivers them as Supabase
 * Broadcast messages on private topics: the broadcast `event` is the key under
 * `serverEvents.<topic>` in events.schema.json (pinned by `npm run gen:events`), and the
 * broadcast `payload` is the event body. Shapes shared with the OpenAPI contract are typed
 * against it, so drift fails typecheck; events.test.ts checks names and required keys against
 * the pinned schema.
 */

type Schemas = components['schemas']

// Mirrors hideout-api's contract (src/contracts/events.ts).
const id = z.guid()
const timestamp = z.iso.datetime({ offset: true })
const httpsUrl = z.url({ protocol: /^https$/ })

const roomIconSchema: z.ZodType<Schemas['RoomIcon']> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('emoji'), emoji: z.string() }),
  z.object({ kind: z.literal('image'), url: httpsUrl }),
])

const roomSchema: z.ZodType<Schemas['Room']> = z.object({
  id,
  name: z.string(),
  icon: roomIconSchema,
  createdAt: timestamp,
})

// Every contract channel type, and no others (`satisfies` rejects missing and extra keys).
const channelTypeSchema: z.ZodType<Schemas['ChannelType']> = z.enum({
  text: 'text',
  voice: 'voice',
} satisfies { [K in Schemas['ChannelType']]: K })

// Bounds from the contract, so a bad broadcast is rejected, never truncated: ChannelName is
// 1–32 UTF-16 code units (what `.length` counts), and a room holds at most 50 live channels
// (POST /api/rooms/{roomId}/channels).
const CHANNEL_NAME_MAX = 32
const CHANNELS_PER_ROOM_MAX = 50

const channelSchema: z.ZodType<Schemas['Channel']> = z.object({
  id,
  roomId: id,
  type: channelTypeSchema,
  name: z.string().min(1).max(CHANNEL_NAME_MAX),
  position: z.int(),
})

const profileSummarySchema: z.ZodType<Schemas['ProfileSummary']> = z.object({
  id,
  displayName: z.string(),
  avatarUrl: z.url({ protocol: /^https?$/ }).nullable(),
})

// Every contract role, and no others.
const roleSchema: z.ZodType<Schemas['Role']> = z.enum({
  owner: 'owner',
  admin: 'admin',
  member: 'member',
} satisfies { [K in Schemas['Role']]: K })

const memberSchema: z.ZodType<Schemas['Member']> = z.object({
  roomId: id,
  user: profileSummarySchema,
  role: roleSchema,
  joinedAt: timestamp,
  currentGame: z.string().nullable(),
})

/** Events on `room:<roomId>` that this app handles. */
export const roomEventSchemas = {
  'room:updated': z.object({ room: roomSchema }),
  'room:deleted': z.object({ id }),
  'channel:created': z.object({ channel: channelSchema }),
  'channel:updated': z.object({ channel: channelSchema }),
  'channel:reordered': z.object({
    roomId: id,
    type: channelTypeSchema,
    channelIds: z.array(id).max(CHANNELS_PER_ROOM_MAX),
  }),
  'channel:deleted': z.object({ id, roomId: id }),
  'member:joined': z.object({ member: memberSchema }),
}

// A message body is at most 2000 Unicode code points (MessageBody in the contract). Counted
// with Array.from (code points, so an emoji counts once); a longer body is rejected, never cut.
const MESSAGE_BODY_MAX = 2000

const messageSchema: z.ZodType<Schemas['Message']> = z.object({
  id,
  channelId: id,
  // null: the author's profile was deleted.
  author: profileSummarySchema.nullable(),
  body: z.string().refine((body) => Array.from(body).length <= MESSAGE_BODY_MAX, {
    message: `At most ${MESSAGE_BODY_MAX} code points`,
  }),
  createdAt: timestamp,
  editedAt: timestamp.nullable(),
})

/** Events on `channel:<channelId>` (a text channel's messages) that this app handles. */
export const channelEventSchemas = {
  'message:created': z.object({ message: messageSchema }),
  'message:updated': z.object({ message: messageSchema }),
  'message:deleted': z.object({ id, channelId: id }),
}

// Same shape as InboxInvite in the OpenAPI contract (GET /api/me/invites entries).
const inboxInviteSchema: z.ZodType<Schemas['InboxInvite']> = z.object({
  inviteId: id,
  room: z.object({ id, name: z.string(), icon: roomIconSchema }),
  invitedBy: profileSummarySchema,
  expiresAt: timestamp.nullable(),
})

/** Events on `user:<profileId>` that this app handles. */
export const userEventSchemas = {
  'invite:received': inboxInviteSchema,
  // Idempotent; can arrive right before a replacement `invite:received`.
  'invite:revoked': z.object({ inviteId: id }),
  'member:removed': z.object({ roomId: id, banned: z.boolean().optional() }),
  // Empty today; extra keys are allowed so additive changes don't drop it.
  'session:expired': z.object({}),
}

type EventSchemas = Record<string, z.ZodType>

/** A parsed event: `{ event, data }`, discriminated on `event`. */
export type ParsedEvent<S extends EventSchemas> = {
  [K in keyof S & string]: { event: K; data: z.output<S[K]> }
}[keyof S & string]

export type RoomEvent = ParsedEvent<typeof roomEventSchemas>
export type ChannelEvent = ParsedEvent<typeof channelEventSchemas>
export type UserEvent = ParsedEvent<typeof userEventSchemas>

/**
 * Validate a broadcast. Unknown events (e.g. ones another feature handles) return null quietly;
 * an invalid payload for a known event returns null with a dev-only warning that names the
 * event and the failing fields, never the payload itself.
 */
function parseEvent<S extends EventSchemas>(
  schemas: S,
  event: string,
  payload: unknown,
): ParsedEvent<S> | null {
  if (!Object.hasOwn(schemas, event)) return null
  const schema = schemas[event]!
  const result = schema.safeParse(payload)
  if (!result.success) {
    if (import.meta.env.DEV) {
      const fields = result.error.issues.map((issue) => issue.path.join('.') || '(root)')
      console.warn(`Ignored an invalid "${event}" realtime event`, fields)
    }
    return null
  }
  return { event, data: result.data } as ParsedEvent<S>
}

export function parseRoomEvent(event: string, payload: unknown): RoomEvent | null {
  return parseEvent(roomEventSchemas, event, payload)
}

export function parseChannelEvent(event: string, payload: unknown): ChannelEvent | null {
  return parseEvent(channelEventSchemas, event, payload)
}

export function parseUserEvent(event: string, payload: unknown): UserEvent | null {
  return parseEvent(userEventSchemas, event, payload)
}

/** Topic names. Lowercase ids: hideout-api broadcasts to lowercase topics, matched exactly. */
export const realtimeTopics = {
  room: (roomId: string) => `room:${roomId.toLowerCase()}`,
  channel: (channelId: string) => `channel:${channelId.toLowerCase()}`,
  user: (profileId: string) => `user:${profileId.toLowerCase()}`,
}
