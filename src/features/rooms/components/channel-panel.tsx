import { Plus } from 'lucide-react'
import { useId } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
} from '@/components/ui/sidebar'
import type { RoomDetail } from '../types'
import { RoomMenu } from './room-menu'
import { TextChannelItem } from './text-channel-item'
import { VoiceChannelItem } from './voice-channel-item'

interface ChannelPanelProps {
  room: RoomDetail
  /** The channel in the URL, if any. */
  activeChannelId?: string
}

/**
 * Nav panel content for a room: room menu header, then text and voice channels. Rendered by
 * the shell's NavPanel, which adds the footer.
 */
export function ChannelPanel({ room, activeChannelId }: ChannelPanelProps) {
  const ids = { text: useId(), voice: useId() }
  const textChannels = room.channels.filter((channel) => channel.type === 'text')
  const voiceChannels = room.channels.filter((channel) => channel.type === 'voice')
  // UI-only gate; hideout-api enforces the role on channel writes.
  const canManageChannels = room.myRole !== 'member'

  return (
    <>
      <SidebarHeader className="h-12 shrink-0 justify-center border-b border-sidebar-border px-2 py-0">
        <RoomMenu room={room} />
      </SidebarHeader>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Channels">
          <SidebarGroup>
            <SidebarGroupLabel id={ids.text}>Text channels</SidebarGroupLabel>
            {canManageChannels && (
              // TODO(channels): open the create-channel Dialog (text).
              <SidebarGroupAction type="button" aria-label="Create text channel">
                <Plus aria-hidden="true" />
              </SidebarGroupAction>
            )}
            <SidebarGroupContent>
              <SidebarMenu aria-labelledby={ids.text}>
                {textChannels.map((channel) => (
                  <TextChannelItem
                    key={channel.id}
                    roomId={room.room.id}
                    channel={channel}
                    isActive={channel.id === activeChannelId}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel id={ids.voice}>Voice channels</SidebarGroupLabel>
            {canManageChannels && (
              // TODO(channels): open the create-channel Dialog (voice).
              <SidebarGroupAction type="button" aria-label="Create voice channel">
                <Plus aria-hidden="true" />
              </SidebarGroupAction>
            )}
            <SidebarGroupContent>
              <SidebarMenu aria-labelledby={ids.voice}>
                {voiceChannels.map((channel) => (
                  <VoiceChannelItem
                    key={channel.id}
                    roomId={room.room.id}
                    channel={channel}
                    isActive={channel.id === activeChannelId}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </ScrollArea>
    </>
  )
}
