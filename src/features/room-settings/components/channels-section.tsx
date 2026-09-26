import type { RoomDetail } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { ChannelGroup } from './channel-group'
import { SettingsSectionHeader } from './settings-section-header'

interface ChannelsSectionProps {
  room: RoomDetail
  className?: string
}

/** Text and voice channels: create, rename, reorder and delete. */
export function ChannelsSection({ room, className }: ChannelsSectionProps) {
  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <SettingsSectionHeader title="Channels" />
      <ChannelGroup room={room} type="text" title="Text channels" emptyText="No text channels yet" />
      <ChannelGroup
        room={room}
        type="voice"
        title="Voice channels"
        emptyText="No voice channels yet"
      />
    </div>
  )
}
