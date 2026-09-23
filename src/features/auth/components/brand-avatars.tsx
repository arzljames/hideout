import { Avatar, AvatarFallback, AvatarGroup } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface BrandAvatarsProps {
  className?: string
}

/** Decorative squad illustration for the sign-in screen. */
export function BrandAvatars({ className }: BrandAvatarsProps) {
  return (
    <div aria-hidden="true" className={cn('flex justify-center', className)}>
      <AvatarGroup className="items-center">
        <Avatar size="lg">
          <AvatarFallback tone="persona-1">
            M
          </AvatarFallback>
        </Avatar>
        <Avatar size="xl" emphasis className="z-10">
          <AvatarFallback tone="persona-2">
            J
          </AvatarFallback>
        </Avatar>
        <Avatar size="lg">
          <AvatarFallback tone="persona-3">
            A
          </AvatarFallback>
        </Avatar>
      </AvatarGroup>
    </div>
  )
}
