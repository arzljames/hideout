import { Link } from '@tanstack/react-router'
import { cva } from 'class-variance-authority'
import { Volume2 } from 'lucide-react'
import { SidebarMenuButton } from '@/components/ui/sidebar'
import type { Channel } from '@/features/rooms'
import { useVoiceStore } from '@/features/voice'
import { ChannelSidebarRow } from './channel-sidebar-row'
import type { SortableChannelItem } from './sortable-channel-row'

const voiceChannelIconVariants = cva('', {
  variants: {
    connected: {
      true: 'text-primary',
      false: '',
    },
  },
})

interface VoiceChannelItemProps {
  roomId: string
  channel: Channel
  isActive: boolean
  /** Present for owners and admins (from SortableChannelList). */
  item?: SortableChannelItem
  className?: string
}

/**
 * A voice channel link. TODO(livekit): list who's in the channel underneath
 * (voice-realtime-engineer).
 */
export function VoiceChannelItem({
  roomId,
  channel,
  isActive,
  item,
  className,
}: VoiceChannelItemProps) {
  const connection = useVoiceStore((s) => s.connection)
  const connected = connection?.roomId === roomId && connection.channelId === channel.id

  return (
    <ChannelSidebarRow channel={channel} item={item} className={className}>
      <SidebarMenuButton asChild isActive={isActive} trailingActions={item ? 'two' : 'one'}>
        <Link to="/rooms/$roomId/$channelId" params={{ roomId, channelId: channel.id }}>
          <Volume2 aria-hidden="true" className={voiceChannelIconVariants({ connected })} />
          <span className="truncate">
            <bdi>{channel.name}</bdi>
            {connected && (
              <>
                {' '}
                <span className="sr-only">(connected)</span>
              </>
            )}
          </span>
        </Link>
      </SidebarMenuButton>
    </ChannelSidebarRow>
  )
}
