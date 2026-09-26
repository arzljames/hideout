import { Hash } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { CenteredState } from '@/components/centered-state'
import { cn } from '@/lib/utils'
import type { RoomDetail } from '../types'
import { MemberPanelToggle } from './member-panel-toggle'

interface RoomNoChannelsProps {
  room: RoomDetail
  className?: string
}

/** A room with no text channel to open (the API always creates one, so this is rare). */
export function RoomNoChannels({ room, className }: RoomNoChannelsProps) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <AppHeader title={room.room.name} actions={<MemberPanelToggle />} />
      <CenteredState
        tone="muted"
        icon={<Hash aria-hidden="true" />}
        title="No text channels yet"
        description={
          room.myRole === 'member'
            ? 'Ask an admin to add one.'
            : 'Add a text channel to start talking.'
        }
      />
    </div>
  )
}
