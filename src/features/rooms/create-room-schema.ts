import { z } from 'zod'
import { DEFAULT_ROOM_EMOJI, ROOM_EMOJIS } from './room-emojis'

/** RoomName in the hideout-api contract: 1–48 UTF-16 code units after trimming. */
export const ROOM_NAME_MAX_LENGTH = 48

/**
 * Room name rules, shared by Create room and Room settings. The API also rejects invisible
 * and control characters; its 422 message is shown on the field when that happens.
 */
export const roomNameSchema = z
  .string()
  .trim()
  .min(1, 'Give your room a name')
  .max(ROOM_NAME_MAX_LENGTH, `At most ${ROOM_NAME_MAX_LENGTH} characters`)

export const roomEmojiSchema = z.enum(ROOM_EMOJIS)

export const createRoomSchema = z.object({
  name: roomNameSchema,
  emoji: roomEmojiSchema,
})

export type CreateRoomValues = z.infer<typeof createRoomSchema>

export const createRoomDefaults: CreateRoomValues = { name: '', emoji: DEFAULT_ROOM_EMOJI }
