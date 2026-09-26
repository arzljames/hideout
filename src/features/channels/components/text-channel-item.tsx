import { Link } from '@tanstack/react-router'
import { Hash } from 'lucide-react'
import { SidebarMenuButton } from '@/components/ui/sidebar'
import type { Channel } from '@/features/rooms'
import { ChannelSidebarRow } from './channel-sidebar-row'
import type { SortableChannelItem } from './sortable-channel-row'

interface TextChannelItemProps {
  roomId: string
  channel: Channel
  isActive: boolean
  /** Present for owners and admins (from SortableChannelList). */
  item?: SortableChannelItem
  className?: string
}

/** A text channel link in the channel panel. */
export function TextChannelItem({ roomId, channel, isActive, item, className }: TextChannelItemProps) {
  return (
    <ChannelSidebarRow channel={channel} item={item} className={className}>
      <SidebarMenuButton asChild isActive={isActive} trailingActions={item ? 'two' : 'one'}>
        <Link to="/rooms/$roomId/$channelId" params={{ roomId, channelId: channel.id }}>
          <Hash aria-hidden="true" />
          <span className="truncate text-sidebar-foreground/75">
            <bdi>{channel.name}</bdi>
          </span>
        </Link>
      </SidebarMenuButton>
    </ChannelSidebarRow>
  )
}
