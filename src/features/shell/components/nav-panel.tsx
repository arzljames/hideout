import { useParams } from '@tanstack/react-router'
import { SidebarFooter } from '@/components/ui/sidebar'
import type { Me } from '@/features/auth'
import { ChannelPanel, getSampleRoom } from '@/features/rooms'
import { VoiceConnectionBar } from '@/features/voice'
import { cn } from '@/lib/utils'
import { AccountBar } from './account-bar'
import { HomePanel } from './home-panel'

interface NavPanelProps {
  /** `undefined` while the session is loading; `null` when there's no session to show. */
  user: Me | null | undefined
  className?: string
}

/**
 * Second sidebar column: the room's channels when a room is open (Home sections otherwise),
 * then the voice connection bar and account bar.
 */
export function NavPanel({ user, className }: NavPanelProps) {
  const { roomId, channelId } = useParams({ strict: false })
  // TODO(api): roomQueryOptions; a room you can't see falls back to the Home panel.
  const room = roomId ? getSampleRoom(roomId) : undefined

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col bg-sidebar', className)}>
      {room ? <ChannelPanel room={room} activeChannelId={channelId} /> : <HomePanel />}

      <SidebarFooter className="border-t border-sidebar-border">
        <VoiceConnectionBar />
        <AccountBar user={user} />
      </SidebarFooter>
    </div>
  )
}
