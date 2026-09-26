import { Link } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SettingsForbiddenProps {
  roomId: string
  roomName: string
  defaultChannelId: string
  className?: string
}

/** Room settings for a plain member: explain who can change them, and link back. */
export function SettingsForbidden({
  roomId,
  roomName,
  defaultChannelId,
  className,
}: SettingsForbiddenProps) {
  return (
    <main className={cn('flex min-h-svh flex-col bg-background', className)}>
      <CenteredState
        titleLevel={1}
        tone="muted"
        icon={<ShieldAlert aria-hidden="true" />}
        title="Only the owner and admins can change room settings"
        description={`Ask an admin of ${roomName} if something needs changing.`}
        actions={
          <Button asChild>
            <Link to="/rooms/$roomId/$channelId" params={{ roomId, channelId: defaultChannelId }}>
              Back to {roomName}
            </Link>
          </Button>
        }
      />
    </main>
  )
}
