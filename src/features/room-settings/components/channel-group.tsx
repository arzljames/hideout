import { Plus } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import type { Channel } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { ChannelSettingsRow } from './channel-settings-row'

interface ChannelGroupProps {
  title: string
  channels: Channel[]
  /** Shown instead of the list when there are no channels, e.g. "No voice channels yet". */
  emptyText: string
  className?: string
}

/** "Text channels" / "Voice channels" block in Room settings. */
export function ChannelGroup({ title, channels, emptyText, className }: ChannelGroupProps) {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={titleId} className="text-sm font-semibold">
          {title}
        </h2>
        {/* TODO(channels): open the create-channel Dialog for this kind. */}
        <Button type="button" variant="outline" size="sm">
          <Plus aria-hidden="true" />
          Create channel
        </Button>
      </div>
      {channels.length > 0 ? (
        <ul role="list" aria-labelledby={titleId} className="divide-y divide-border">
          {channels.map((channel) => (
            <ChannelSettingsRow key={channel.id} channel={channel} />
          ))}
        </ul>
      ) : (
        <p className="py-2 text-sm text-muted-foreground">{emptyText}</p>
      )}
    </section>
  )
}
