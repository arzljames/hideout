import { Link } from '@tanstack/react-router'
import { cva } from 'class-variance-authority'
import { Volume2 } from 'lucide-react'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { useVoiceStore } from '@/features/voice'
import { cn } from '@/lib/utils'
import type { Channel } from '../types'

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
  className?: string
}

/**
 * A voice channel link. TODO(livekit): list who's in the channel underneath
 * (voice-realtime-engineer).
 */
export function VoiceChannelItem({ roomId, channel, isActive, className }: VoiceChannelItemProps) {
  const connection = useVoiceStore((s) => s.connection)
  const connected = connection?.roomId === roomId && connection.channelId === channel.id

  return (
    <SidebarMenuItem className={cn(className)}>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link to="/rooms/$roomId/$channelId" params={{ roomId, channelId: channel.id }}>
          <Volume2 aria-hidden="true" className={voiceChannelIconVariants({ connected })} />
          <span className="truncate">
            {channel.name}
            {connected && (
              <>
                {' '}
                <span className="sr-only">(connected)</span>
              </>
            )}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
