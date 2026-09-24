import { Hash } from 'lucide-react'
import { CenteredState } from '@/components/centered-state'
import type { Room, TextChannel } from '@/features/rooms'
import {
  Composer,
  getSampleMessages,
  getSampleTyping,
  MessageList,
  sampleViewerId,
  TypingIndicator,
} from '@/features/messages'
import { cn } from '@/lib/utils'
import { ChannelHeader } from './channel-header'

interface TextChannelViewProps {
  room: Room
  channel: TextChannel
  className?: string
}

/** A text channel: header, messages (or the channel's empty start), typing line, composer. */
export function TextChannelView({ room, channel, className }: TextChannelViewProps) {
  // TODO(api): messagesQueryOptions + the Realtime subscription (voice-realtime-engineer).
  const messages = getSampleMessages(room.id, channel.id)
  const typing = getSampleTyping(room.id, channel.id)

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <ChannelHeader room={room} channel={channel} />
      {messages.length > 0 ? (
        <MessageList channelName={channel.name} messages={messages} viewerId={sampleViewerId} />
      ) : (
        <CenteredState
          icon={<Hash aria-hidden="true" />}
          title={`This is the start of #${channel.name}`}
          description={`Only members of ${room.name} can see what's posted here. Say hi, or drop the first clip.`}
        />
      )}
      <TypingIndicator names={typing} />
      <Composer channelName={channel.name} />
    </div>
  )
}
