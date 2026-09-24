import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { isRoomEmoji, ROOM_EMOJI_NAMES, ROOM_EMOJIS, type RoomEmoji } from '../room-emojis'

interface RoomEmojiGridProps {
  value: RoomEmoji
  onValueChange: (value: RoomEmoji) => void
  className?: string
}

/**
 * Single-select grid of the room emoji (a radiogroup of toggle tiles). Always has a selection:
 * clicking the selected tile again keeps it. Used by Create room and Room settings.
 */
export function RoomEmojiGrid({ value, onValueChange, className }: RoomEmojiGridProps) {
  return (
    <ToggleGroup
      type="single"
      // Single-select items are role="radio"; Radix leaves the root role-less.
      role="radiogroup"
      variant="tile"
      size="tile"
      aria-label="Room icon"
      value={value}
      // Radix sends "" when the selected item is clicked again; keep the current pick.
      onValueChange={(next) => {
        if (isRoomEmoji(next)) onValueChange(next)
      }}
      className={cn('grid w-full grid-cols-6', className)}
    >
      {ROOM_EMOJIS.map((emoji) => (
        <ToggleGroupItem key={emoji} value={emoji} aria-label={ROOM_EMOJI_NAMES[emoji]}>
          <span aria-hidden="true">{emoji}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
