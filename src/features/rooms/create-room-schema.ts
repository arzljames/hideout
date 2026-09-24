import { z } from 'zod'
import { DEFAULT_ROOM_EMOJI, ROOM_EMOJIS } from './room-emojis'

export const ROOM_NAME_MAX_LENGTH = 40

// TODO(api): align limits with the create-room request in the hideout-api contract.
export const createRoomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give your room a name')
    .max(ROOM_NAME_MAX_LENGTH, `At most ${ROOM_NAME_MAX_LENGTH} characters`),
  emoji: z.enum(ROOM_EMOJIS),
})

export type CreateRoomValues = z.infer<typeof createRoomSchema>

export const createRoomDefaults: CreateRoomValues = { name: '', emoji: DEFAULT_ROOM_EMOJI }
