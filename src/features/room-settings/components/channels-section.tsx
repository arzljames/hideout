import type { RoomDetail } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { ChannelGroup } from './channel-group'
import { SettingsSectionHeader } from './settings-section-header'

interface ChannelsSectionProps {
  room: RoomDetail
  className?: string
}

/** Text and voice channels, with (inert) create, rename and delete. */
export function ChannelsSection({ room, className }: ChannelsSectionProps) {
  const text = room.channels.filter((channel) => channel.type === 'text')
  const voice = room.channels.filter((channel) => channel.type === 'voice')

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <SettingsSectionHeader title="Channels" />
      <ChannelGroup title="Text channels" channels={text} emptyText="No text channels yet" />
      <ChannelGroup title="Voice channels" channels={voice} emptyText="No voice channels yet" />
    </div>
  )
}
