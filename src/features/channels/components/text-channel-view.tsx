import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { Channel, RoomDetail } from '@/features/rooms'
import {
  Composer,
  flattenMessages,
  MessageList,
  messagesQueryOptions,
  startEditing,
  useChannelMessages,
  useMessagePermissions,
} from '@/features/messages'
import { cn } from '@/lib/utils'
import { ChannelHeader } from './channel-header'

interface TextChannelViewProps {
  room: RoomDetail
  channel: Channel
  className?: string
}

/** A text channel: header, messages (or the empty state) with pending sends, composer. */
export function TextChannelView({ room, channel, className }: TextChannelViewProps) {
  const queryClient = useQueryClient()
  const roomId = room.room.id
  const { canEdit } = useMessagePermissions(roomId)
  // Live messages while this text channel is open (joins `channel:<id>`, left on unmount).
  // The future `typing:<id>` topic joins inside the same hook.
  useChannelMessages(roomId, channel.id)

  // ArrowUp in an empty composer edits your last loaded message.
  const editLastOwnMessage = useCallback(() => {
    const data = queryClient.getQueryData(messagesQueryOptions(channel.id).queryKey)
    const last = flattenMessages(data).findLast(canEdit)
    if (!last) return false
    startEditing(channel.id, { messageId: last.id })
    return true
  }, [canEdit, channel.id, queryClient])

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <ChannelHeader room={room} channel={channel} />
      <MessageList
        roomId={roomId}
        roomName={room.room.name}
        channelId={channel.id}
        channelName={channel.name}
      />
      <Composer
        roomId={roomId}
        channelId={channel.id}
        channelName={channel.name}
        onEditLast={editLastOwnMessage}
      />
    </div>
  )
}
