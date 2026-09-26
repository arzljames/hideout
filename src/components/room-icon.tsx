import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const roomIconVariants = cva('flex shrink-0 items-center justify-center bg-muted select-none', {
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
})

interface RoomIconProps extends VariantProps<typeof roomIconVariants> {
  emoji: string
  className?: string
}

/** A room's emoji icon on a muted tile. Decorative: the room name should be shown alongside it. */
export function RoomIcon({ emoji, size, className }: RoomIconProps) {
  return (
    <div data-slot="room-icon" className={cn(roomIconVariants({ size }), className)}>
      <span aria-hidden="true" className="leading-none">
        {emoji}
      </span>
    </div>
  )
}
