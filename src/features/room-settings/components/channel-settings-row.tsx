import { Hash, Pencil, Trash2, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Channel } from '@/features/rooms'
import { cn } from '@/lib/utils'

interface ChannelSettingsRowProps {
  channel: Channel
  className?: string
}

/** A channel with inert Rename and Delete actions. */
export function ChannelSettingsRow({ channel, className }: ChannelSettingsRowProps) {
  const Icon = channel.kind === 'text' ? Hash : Volume2

  return (
    <li className={cn('flex items-center gap-2 py-2', className)}>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm">{channel.name}</span>
      {/* TODO(channels): rename channel Dialog. */}
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Rename ${channel.name}`}>
        <Pencil aria-hidden="true" />
      </Button>
      {/* TODO(channels): confirm with an AlertDialog, then delete via the API. */}
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete ${channel.name}`}>
        <Trash2 aria-hidden="true" />
      </Button>
    </li>
  )
}
