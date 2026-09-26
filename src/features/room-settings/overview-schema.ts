import { z } from 'zod'
import {
  DEFAULT_ROOM_EMOJI,
  isRoomEmoji,
  roomEmojiSchema,
  roomNameSchema,
  type Room,
} from '@/features/rooms'

/** Room settings Overview: same name and emoji rules as Create room. */
export const overviewSchema = z.object({
  name: roomNameSchema,
  emoji: roomEmojiSchema,
})

export type OverviewValues = z.infer<typeof overviewSchema>

export function overviewDefaults(room: Room): OverviewValues {
  return {
    name: room.name,
    emoji: isRoomEmoji(room.emoji) ? room.emoji : DEFAULT_ROOM_EMOJI,
  }
}
