import { Plus } from 'lucide-react'
import { useId, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { CreateChannelDialog, SortableChannelList } from '@/features/channels'
import type { ChannelType, RoomDetail } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { ChannelSettingsRow } from './channel-settings-row'

interface ChannelGroupProps {
  room: RoomDetail
  type: ChannelType
  title: string
  /** Shown instead of the list when there are no channels, e.g. "No voice channels yet". */
  emptyText: string
  className?: string
}

/** "Text channels" / "Voice channels" block in Room settings. */
export function ChannelGroup({ room, type, title, emptyText, className }: ChannelGroupProps) {
  const titleId = useId()
  const createRef = useRef<HTMLButtonElement>(null)
  const roomId = room.room.id
  const channels = room.channels.filter((channel) => channel.type === type)

  return (
    <section aria-labelledby={titleId} className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={titleId} className="text-sm font-semibold">
          {title}
        </h2>
        {/* Stay in settings after creating, so several channels can be set up in a row. */}
        <CreateChannelDialog
          roomId={roomId}
          channels={room.channels}
          defaultType={type}
          openTextChannel={false}
        >
          <Button ref={createRef} type="button" variant="outline" size="sm">
            <Plus aria-hidden="true" />
            Create channel
          </Button>
        </CreateChannelDialog>
      </div>
      {/* Always mounted (it owns the Delete dialog), also once the group is empty. */}
      <SortableChannelList
        roomId={roomId}
        type={type}
        channels={channels}
        fallbackFocusRef={createRef}
        renderList={(rows) => (
          <ul role="list" aria-labelledby={titleId} className="divide-y divide-border">
            {rows}
          </ul>
        )}
        empty={<p className="py-2 text-sm text-muted-foreground">{emptyText}</p>}
      >
        {(channel, item) => <ChannelSettingsRow channel={channel} item={item} />}
      </SortableChannelList>
    </section>
  )
}
