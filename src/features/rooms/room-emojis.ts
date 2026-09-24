/** Emoji a room can use as its icon, in picker order. */
export const ROOM_EMOJIS = ['🦉', '⚔️', '🎮', '🍄', '🛡️', '🏎️', '🐍', '🌙', '⛏️', '🎲', '🔥', '🌵'] as const

export type RoomEmoji = (typeof ROOM_EMOJIS)[number]

export const DEFAULT_ROOM_EMOJI: RoomEmoji = '🦉'

/** Accessible names for the picker, since emoji alone announce inconsistently. */
export const ROOM_EMOJI_NAMES: Record<RoomEmoji, string> = {
  '🦉': 'Owl',
  '⚔️': 'Crossed swords',
  '🎮': 'Game controller',
  '🍄': 'Mushroom',
  '🛡️': 'Shield',
  '🏎️': 'Racing car',
  '🐍': 'Snake',
  '🌙': 'Crescent moon',
  '⛏️': 'Pick',
  '🎲': 'Game die',
  '🔥': 'Fire',
  '🌵': 'Cactus',
}

export function isRoomEmoji(value: string): value is RoomEmoji {
  return (ROOM_EMOJIS as readonly string[]).includes(value)
}
