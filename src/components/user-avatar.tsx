import type { ComponentProps } from 'react'
import type { VariantProps } from 'class-variance-authority'
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
  type avatarFallbackVariants,
} from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  name: string
  /** Profile image URL; the initials show while it loads, and when it's missing or fails. */
  src?: string | null
  /** Defaults to the first letter of `name`. */
  initials?: string
  tone?: VariantProps<typeof avatarFallbackVariants>['tone']
  size?: ComponentProps<typeof Avatar>['size']
  status?: 'online' | 'offline'
  /** Primary ring, e.g. while the user is speaking. */
  emphasis?: boolean
  className?: string
}

/**
 * Profile image (or initials) avatar with an optional presence dot. The image, initials and dot
 * are hidden from assistive tech; render the user's name (and status, where it matters) as
 * text next to it.
 */
export function UserAvatar({
  name,
  src,
  initials,
  tone,
  size,
  status,
  emphasis,
  className,
}: UserAvatarProps) {
  // Array.from splits by code point, so emoji and styled letters stay whole.
  const fallback = (initials ?? Array.from(name.trim())[0] ?? '?').toUpperCase()

  return (
    <Avatar size={size} emphasis={emphasis} className={cn(className)}>
      {/* Decorative: the name is rendered as text next to the avatar. */}
      {src && <AvatarImage src={src} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback tone={tone} aria-hidden="true">
        {fallback}
      </AvatarFallback>
      {status && <AvatarBadge status={status} aria-hidden="true" />}
    </Avatar>
  )
}
