import { Link } from '@tanstack/react-router'
import { cva } from 'class-variance-authority'
import { Volume2 } from 'lucide-react'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { useVoiceParticipants } from '../hooks/use-voice-participants'
import type { Room, VoiceChannel } from '../sample-room'
import { VoiceParticipantItem } from './voice-participant-item'

const voiceChannelIconVariants = cva('', {
  variants: {
    connected: {
      true: 'text-primary',
      false: '',
    },
  },
})

interface VoiceChannelItemProps {
  room: Room
  channel: VoiceChannel
  isActive: boolean
  className?: string
}

/** A voice channel link with its participants listed underneath. */
export function VoiceChannelItem({ room, channel, isActive, className }: VoiceChannelItemProps) {
  const { participants, viewerConnected } = useVoiceParticipants(room, channel)

  return (
    <SidebarMenuItem className={cn(className)}>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link to="/rooms/$roomId/$channelId" params={{ roomId: room.id, channelId: channel.id }}>
          <Volume2 aria-hidden="true" className={voiceChannelIconVariants({ connected: viewerConnected })} />
          <span className="truncate">
            {channel.name}
            {viewerConnected && (
              <>
                {' '}
                <span className="sr-only">(connected)</span>
              </>
            )}
          </span>
        </Link>
      </SidebarMenuButton>

      {participants.length > 0 && (
        <SidebarMenuSub aria-label={`In ${channel.name}`}>
          {participants.map(({ member, muted, deafened, speaking }) => (
            <VoiceParticipantItem
              key={member.id}
              member={member}
              muted={muted}
              deafened={deafened}
              speaking={speaking}
            />
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  )
}
