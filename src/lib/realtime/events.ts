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

/** Events on `room:<roomId>` that this app handles. */
export const roomEventSchemas = {
  'room:updated': z.object({ room: roomSchema }),
  'room:deleted': z.object({ id }),
}

/** Events on `user:<profileId>` that this app handles. */
export const userEventSchemas = {
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

export function parseUserEvent(event: string, payload: unknown): UserEvent | null {
  return parseEvent(userEventSchemas, event, payload)
}

/** Topic names. Lowercase ids: hideout-api broadcasts to lowercase topics, matched exactly. */
export const realtimeTopics = {
  room: (roomId: string) => `room:${roomId.toLowerCase()}`,
  user: (profileId: string) => `user:${profileId.toLowerCase()}`,
}
