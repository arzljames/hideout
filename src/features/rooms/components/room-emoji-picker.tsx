import { Upload } from 'lucide-react'
import { RoomIcon } from '@/components/room-icon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RoomEmoji } from '../room-emojis'
import { RoomEmojiGrid } from './room-emoji-grid'

interface RoomEmojiPickerProps {
  value: RoomEmoji
  onValueChange: (value: RoomEmoji) => void
  className?: string
}

/** Preview tile plus the emoji grid and an upload button (Create room). */
export function RoomEmojiPicker({ value, onValueChange, className }: RoomEmojiPickerProps) {
  return (
    <div className={cn('flex items-start gap-4', className)}>
      <RoomIcon emoji={value} />

      <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
        <RoomEmojiGrid value={value} onValueChange={onValueChange} />

        {/* TODO(rooms): image upload */}
        <Button type="button" variant="outline" size="sm">
          <Upload aria-hidden="true" />
          Upload image
        </Button>
      </div>
    </div>
  )
}
