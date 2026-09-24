import { cn } from '@/lib/utils'
import type { MessageGroupData } from '../lib/group-messages'
import { MessageRow } from './message-row'

interface MessageGroupProps {
  group: MessageGroupData
  viewerId: string
  /** The message that currently holds the log's single tab stop. */
  activeMessageId: string | undefined
  onFocusMessage: (messageId: string) => void
  className?: string
}

/** Consecutive messages from one author, under a single avatar and header. */
export function MessageGroup({
  group,
  viewerId,
  activeMessageId,
  onFocusMessage,
  className,
}: MessageGroupProps) {
  const isOwn = group.author.id === viewerId

  return (
    <div className={cn('flex flex-col', className)}>
      {group.messages.map((message, index) => (
        <MessageRow
          key={message.id}
          message={message}
          isFirst={index === 0}
          isOwn={isOwn}
          isTabStop={message.id === activeMessageId}
          onFocusRow={onFocusMessage}
        />
      ))}
    </div>
  )
}
