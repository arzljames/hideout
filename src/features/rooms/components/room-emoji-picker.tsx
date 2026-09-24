import { Upload } from 'lucide-react'
import { RoomIcon } from '@/components/room-icon'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { isRoomEmoji, ROOM_EMOJI_NAMES, ROOM_EMOJIS, type RoomEmoji } from '../room-emojis'

interface RoomEmojiPickerProps {
  value: RoomEmoji
  onValueChange: (value: RoomEmoji) => void
  className?: string
}

/** Preview tile plus a single-select emoji grid. Always has a selection. */
export function RoomEmojiPicker({ value, onValueChange, className }: RoomEmojiPickerProps) {
  return (
    <div className={cn('flex items-start gap-4', className)}>
      <RoomIcon emoji={value} />

      <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
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
          className="grid w-full grid-cols-6"
        >
          {ROOM_EMOJIS.map((emoji) => (
            <ToggleGroupItem key={emoji} value={emoji} aria-label={ROOM_EMOJI_NAMES[emoji]}>
              <span aria-hidden="true">{emoji}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* TODO(rooms): image upload */}
        <Button type="button" variant="outline" size="sm">
          <Upload aria-hidden="true" />
          Upload image
        </Button>
      </div>
    </div>
  )
}
