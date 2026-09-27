import { Link } from '@tanstack/react-router'
import { cva } from 'class-variance-authority'
import { Volume2 } from 'lucide-react'
import type { MouseEvent } from 'react'
import { SidebarMenuButton, SidebarMenuSub } from '@/components/ui/sidebar'
import type { Channel } from '@/features/rooms'
import { useVoiceSession } from '@/features/voice'
import { useJoinVoiceChannel, useVoiceChannelPresence } from '../hooks/use-voice-channel'
import { ChannelSidebarRow } from './channel-sidebar-row'
import type { SortableChannelItem } from './sortable-channel-row'
import { VoiceParticipantItem } from './voice-participant-item'

const voiceChannelIconVariants = cva('', {
  variants: {
    connected: {
      true: 'text-primary',
      false: '',
    },
  },
})

/** A plain left click; modified clicks open a new tab/window and must not join here. */
function isPlainClick(event: MouseEvent) {
  return (
    event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
  )
}

interface VoiceChannelItemProps {
  roomId: string
  channel: Channel
  isActive: boolean
  /** Present for owners and admins (from SortableChannelList). */
  item?: SortableChannelItem
  className?: string
}

/**
 * A voice channel link: opens the channel and joins it (just opens it when you're already in
 * it). Who's in the channel is listed underneath, with a speaking ring, and your own mute and
 * deafen state.
 */
export function VoiceChannelItem({
  roomId,
  channel,
  isActive,
  item,
  className,
}: VoiceChannelItemProps) {
  const join = useJoinVoiceChannel(roomId)
  const { participants, viewerId, here, isSpeaking } = useVoiceChannelPresence(roomId, channel.id)
  const muted = useVoiceSession((s) => s.muted)
  const deafened = useVoiceSession((s) => s.deafened)

  const inChannel =
    participants.length > 0 ? (
      <SidebarMenuSub aria-label={`In ${channel.name}`}>
        {participants.map((person) => {
          const isViewer = viewerId !== undefined && person.id === viewerId
          return (
            <VoiceParticipantItem
              key={person.id}
              user={person}
              speaking={isSpeaking(person.id)}
              muted={isViewer && here && muted}
              deafened={isViewer && here && deafened}
            />
          )
        })}
      </SidebarMenuSub>
    ) : null

  return (
    <ChannelSidebarRow channel={channel} item={item} below={inChannel} className={className}>
      <SidebarMenuButton asChild isActive={isActive} trailingActions={item ? 'two' : 'one'}>
        <Link
          to="/rooms/$roomId/$channelId"
          params={{ roomId, channelId: channel.id }}
          onClick={(event) => {
            // join() is a no-op for the channel you're already in (or joining).
            if (isPlainClick(event)) void join(channel)
          }}
        >
          <Volume2 aria-hidden="true" className={voiceChannelIconVariants({ connected: here })} />
          <span className="truncate">
            <bdi>{channel.name}</bdi>
            {here && (
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
