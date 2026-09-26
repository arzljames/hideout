import { Smile, Upload } from 'lucide-react'
import { useId, useState } from 'react'
import { RoomIcon } from '@/components/room-icon'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldTitle } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RoomEmojiGrid, type RoomEmoji } from '@/features/rooms'
import { cn } from '@/lib/utils'

interface RoomIconFieldProps {
  value: RoomEmoji
  onChange: (value: RoomEmoji) => void
  className?: string
}

/**
 * Room icon: a large preview, "Change emoji" (opens the emoji grid in a Popover; picking one
 * closes it and Radix returns focus to the trigger) and an inert "Upload image".
 */
export function RoomIconField({ value, onChange, className }: RoomIconFieldProps) {
  const ids = { title: useId(), hint: useId() }
  const [open, setOpen] = useState(false)

  return (
    <Field aria-labelledby={ids.title} aria-describedby={ids.hint} className={cn(className)}>
      <FieldTitle id={ids.title}>Room icon</FieldTitle>
      <div className="flex flex-wrap items-center gap-4">
        <RoomIcon emoji={value} />
        <div className="flex flex-wrap gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Smile aria-hidden="true" />
                Change emoji
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" aria-label="Choose room emoji" className="w-80">
              <RoomEmojiGrid
                value={value}
                onValueChange={(next) => {
                  onChange(next)
                  setOpen(false)
                }}
              />
            </PopoverContent>
          </Popover>
          {/* TODO(rooms): image upload (validate type and size, show a crop step). */}
          <Button type="button" variant="outline" size="sm">
            <Upload aria-hidden="true" />
            Upload image
          </Button>
        </div>
      </div>
      <FieldDescription id={ids.hint}>PNG or JPG, at least 128 × 128.</FieldDescription>
    </Field>
  )
}
