import { HeadphoneOff, MicOff } from 'lucide-react'
import { SidebarMenuSubItem } from '@/components/ui/sidebar'
import { UserAvatar } from '@/components/user-avatar'
import type { ProfileSummary } from '@/features/rooms'
import { cn } from '@/lib/utils'

interface VoiceParticipantItemProps {
  user: ProfileSummary
  muted?: boolean
  deafened?: boolean
  speaking?: boolean
  className?: string
}

/**
 * Someone in a voice channel, listed under the channel in the channel panel. Mute and deafen
 * are only known (and shown) for yourself.
 */
export function VoiceParticipantItem({
  user,
  muted,
  deafened,
  speaking,
  className,
}: VoiceParticipantItemProps) {
  return (
    <SidebarMenuSubItem className={cn('flex h-7 items-center gap-2 px-2 text-sm', className)}>
      <UserAvatar name={user.displayName} src={user.avatarUrl} size="sm" emphasis={speaking} />
      <span className="min-w-0 flex-1 truncate text-sidebar-foreground/85">
        {user.displayName}
        {speaking && <span className="sr-only">, speaking</span>}
      </span>
      {deafened ? (
        <span className="flex shrink-0 text-muted-foreground">
          <HeadphoneOff aria-hidden="true" className="size-3.5" />
          <span className="sr-only">, deafened</span>
        </span>
      ) : muted ? (
        <span className="flex shrink-0 text-muted-foreground">
          <MicOff aria-hidden="true" className="size-3.5" />
          <span className="sr-only">, muted</span>
        </span>
      ) : null}
    </SidebarMenuSubItem>
  )
}
