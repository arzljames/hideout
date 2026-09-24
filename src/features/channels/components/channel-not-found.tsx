import { Link } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ChannelNotFoundProps {
  roomId: string
  roomName: string
  defaultChannelId: string
  className?: string
}

/** Unknown channel inside a room you're in. */
export function ChannelNotFound({ roomId, roomName, defaultChannelId, className }: ChannelNotFoundProps) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <AppHeader title="Channel not found" />
      <CenteredState
        tone="muted"
        icon={<SearchX aria-hidden="true" />}
        title="This channel doesn't exist"
        description={`It may have been deleted or renamed. Pick another channel in ${roomName}, or go back to the main one.`}
        actions={
          <Button asChild>
            <Link to="/rooms/$roomId/$channelId" params={{ roomId, channelId: defaultChannelId }}>
              Go to {roomName}
            </Link>
          </Button>
        }
      />
    </div>
  )
}
