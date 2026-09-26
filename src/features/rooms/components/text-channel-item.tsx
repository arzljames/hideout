import { Link } from '@tanstack/react-router'
import { Hash } from 'lucide-react'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import type { Channel } from '../types'

interface TextChannelItemProps {
  roomId: string
  channel: Channel
  isActive: boolean
  className?: string
}

/** A text channel link in the channel panel. */
export function TextChannelItem({ roomId, channel, isActive, className }: TextChannelItemProps) {
  return (
    <SidebarMenuItem className={cn(className)}>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link to="/rooms/$roomId/$channelId" params={{ roomId, channelId: channel.id }}>
          <Hash aria-hidden="true" />
          <span className="truncate text-sidebar-foreground/75">{channel.name}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
