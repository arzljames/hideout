import { z } from 'zod'
import {
  DEFAULT_ROOM_EMOJI,
  isRoomEmoji,
  roomEmojiSchema,
  roomNameSchema,
  type Room,
  type RoomDetail,
  type UpdateRoomBody,
} from '@/features/rooms'

/** Room settings Overview: same name and emoji rules as Create room. */
export const overviewSchema = z.object({
  name: roomNameSchema,
  emoji: roomEmojiSchema,
})

export type OverviewValues = z.infer<typeof overviewSchema>

/**
 * The form's starting values. An icon outside the picker (another emoji, or an image) starts
 * the picker on the default emoji, but only counts as a change once the user picks one.
 */
export function overviewDefaults(room: RoomDetail): OverviewValues {
  return overviewValues(room.room)
}

/** The form values for a room's saved name and icon (see `overviewDefaults`). */
export function overviewValues({ name, icon }: Room): OverviewValues {
  return {
    name,
    emoji: icon.kind === 'emoji' && isRoomEmoji(icon.emoji) ? icon.emoji : DEFAULT_ROOM_EMOJI,
  }
}

/** The PATCH body: only the fields that differ from the saved values (empty when none do). */
export function overviewChanges(
  values: OverviewValues,
  saved: OverviewValues,
  dirty: Partial<Record<keyof OverviewValues, boolean | undefined>>,
): UpdateRoomBody {
  const body: UpdateRoomBody = {}
  if (values.name !== saved.name) body.name = values.name
  if (dirty.emoji && values.emoji !== saved.emoji) body.icon = { kind: 'emoji', emoji: values.emoji }
  return body
}
