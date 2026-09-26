import { cva, type VariantProps } from 'class-variance-authority'
import { useState } from 'react'
import type { components } from '@/lib/api/schema.gen'
import { cn } from '@/lib/utils'

type RoomIconData = components['schemas']['RoomIcon']

const roomIconVariants = cva(
  'flex shrink-0 items-center justify-center overflow-hidden bg-muted select-none',
  {
    variants: {
      size: {
        sm: 'size-8 rounded-lg text-base',
        md: 'size-10 rounded-lg text-xl',
        lg: 'size-14 rounded-xl text-3xl',
      },
    },
    defaultVariants: {
      size: 'lg',
    },
  },
)

interface RoomIconProps extends VariantProps<typeof roomIconVariants> {
  icon: RoomIconData
  /** The room's name, for the first-letter fallback when an image icon fails to load. */
  name?: string
  className?: string
}

/**
 * A room's icon on a muted tile: its emoji, or its image (falling back to the name's first
 * letter if the image fails). Decorative: show the room name alongside it.
 */
export function RoomIcon({ icon, name, size, className }: RoomIconProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = icon.kind === 'image' && failedUrl !== icon.url
  // Array.from splits by code point, so an emoji or accented first letter stays whole.
  const letter = (Array.from(name?.trim() ?? '')[0] ?? '?').toUpperCase()

  return (
    <div data-slot="room-icon" className={cn(roomIconVariants({ size }), className)}>
      {icon.kind === 'image' && showImage ? (
        <img
          src={icon.url}
          alt=""
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailedUrl(icon.url)}
        />
      ) : (
        <span aria-hidden="true" className="leading-none font-semibold">
          {icon.kind === 'emoji' ? icon.emoji : letter}
        </span>
      )}
    </div>
  )
}
