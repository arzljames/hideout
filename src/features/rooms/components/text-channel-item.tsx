import { Link } from '@tanstack/react-router'
import { cva } from 'class-variance-authority'
import { Hash } from 'lucide-react'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import type { TextChannel } from '../sample-room'

const channelNameVariants = cva('truncate', {
  variants: {
    unread: {
      true: 'font-semibold text-sidebar-foreground',
      false: 'text-sidebar-foreground/75',
    },
  },
})

interface TextChannelItemProps {
  roomId: string
  channel: TextChannel
  isActive: boolean
  className?: string
}

/** A text channel link in the channel panel. Unread channels are bold. */
export function TextChannelItem({ roomId, channel, isActive, className }: TextChannelItemProps) {
  const unread = Boolean(channel.unread) && !isActive

  return (
    <SidebarMenuItem className={cn(className)}>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link to="/rooms/$roomId/$channelId" params={{ roomId, channelId: channel.id }}>
          <Hash aria-hidden="true" />
          <span className={channelNameVariants({ unread })}>
            {channel.name}
            {unread && (
              <>
                {' '}
                <span className="sr-only">(unread)</span>
              </>
            )}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
