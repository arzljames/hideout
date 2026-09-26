import { HeadphoneOff, MicOff, Volume2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { UserAvatar } from '@/components/user-avatar'
import type { ProfileSummary } from '@/features/rooms'
import { cn } from '@/lib/utils'

interface ParticipantTileProps {
  user: ProfileSummary
  /** The signed-in user's own tile. */
  isViewer?: boolean
  /** e.g. "Playing Elden Ring". */
  activity?: string | null
  muted?: boolean
  deafened?: boolean
  speaking?: boolean
  className?: string
}

/**
 * A person in a voice channel: large avatar, name, activity and voice state badges. Not rendered
 * yet: TODO(livekit): VoiceChannelView lists participants from the voice session.
 */
export function ParticipantTile({
  user,
  isViewer,
  activity,
  muted,
  deafened,
  speaking,
  className,
}: ParticipantTileProps) {
  return (
    <Card tone={speaking ? 'active' : 'default'} className={cn(className)}>
      <CardContent className="flex flex-col items-center gap-2 py-4 text-center">
        <UserAvatar name={user.displayName} src={user.avatarUrl} size="xl" emphasis={speaking} />
        <p className="flex max-w-full items-center gap-1 text-sm font-medium">
          <span className="truncate">{user.displayName}</span>
          {isViewer && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
        </p>
        {activity && <p className="max-w-full truncate text-xs text-primary">{activity}</p>}
        <div className="flex min-h-5 flex-wrap justify-center gap-1">
          {speaking && (
            <Badge variant="soft">
              <Volume2 aria-hidden="true" className="motion-safe:animate-pulse" />
              Speaking
            </Badge>
          )}
          {deafened ? (
            <Badge variant="destructive">
              <HeadphoneOff aria-hidden="true" />
              Deafened
            </Badge>
          ) : muted ? (
            <Badge variant="destructive">
              <MicOff aria-hidden="true" />
              Muted
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
