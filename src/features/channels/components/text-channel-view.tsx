import { MessagesSquare } from 'lucide-react'
import { CenteredState } from '@/components/centered-state'
import type { Channel, RoomDetail } from '@/features/rooms'
import { Composer } from '@/features/messages'
import { cn } from '@/lib/utils'
import { ChannelHeader } from './channel-header'

interface TextChannelViewProps {
  room: RoomDetail
  channel: Channel
  className?: string
}

/** A text channel: header, messages (or the empty state), composer. */
export function TextChannelView({ room, channel, className }: TextChannelViewProps) {
  // TODO(messages): messagesQueryOptions + MessageList, and the Realtime subscription
  // (voice-realtime-engineer). Until then every channel shows its empty state.
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <ChannelHeader room={room} channel={channel} />
      <CenteredState
        icon={<MessagesSquare aria-hidden="true" />}
        title="No messages yet"
        description={`Only members of ${room.room.name} can see what's posted in #${channel.name}.`}
      />
      <Composer channelName={channel.name} />
    </div>
  )
}
