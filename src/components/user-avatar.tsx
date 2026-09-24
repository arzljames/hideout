import type { ComponentProps } from 'react'
import type { VariantProps } from 'class-variance-authority'
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  type avatarFallbackVariants,
} from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  name: string
  /** Defaults to the first letter of `name`. */
  initials?: string
  tone?: VariantProps<typeof avatarFallbackVariants>['tone']
  size?: ComponentProps<typeof Avatar>['size']
  status?: 'online'
  className?: string
}

/**
 * Initials avatar with an optional presence dot. The initials and dot are hidden
 * from assistive tech; render the user's name (and status, where it matters) as
 * text next to it.
 */
export function UserAvatar({ name, initials, tone, size, status, className }: UserAvatarProps) {
  // Array.from splits by code point, so emoji and styled letters stay whole.
  const fallback = (initials ?? Array.from(name.trim())[0] ?? '?').toUpperCase()

  return (
    <Avatar size={size} className={cn(className)}>
      <AvatarFallback tone={tone} aria-hidden="true">
        {fallback}
      </AvatarFallback>
      {status === 'online' && <AvatarBadge status="online" aria-hidden="true" />}
    </Avatar>
  )
}
