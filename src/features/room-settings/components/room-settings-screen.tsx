import { ConnectionBanner } from '@/components/connection-banner'
import { RoomIcon } from '@/components/room-icon'
import { useIsMobile } from '@/hooks/use-mobile'
import type { RoomDetail } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { useEscapeToClose } from '../hooks/use-escape-to-close'
import type { SettingsSection } from '../settings-sections'
import { ChannelsSection } from './channels-section'
import { InvitesSection } from './invites-section'
import { MembersSection } from './members-section'
import { OverviewSection } from './overview-section'
import { SettingsCloseButton } from './settings-close-button'
import { SettingsForbidden } from './settings-forbidden'
import { SettingsNav } from './settings-nav'

interface RoomSettingsScreenProps {
  room: RoomDetail
  section: SettingsSection
  /** Realtime for this room is down for a while: show a non-blocking banner. */
  liveUpdatesPaused?: boolean
  className?: string
}

/**
 * Full-screen Room settings: section nav in a sidebar (a top bar with a scrolling nav row
 * below `md`), and the section in <main>. Esc or the round X goes back to the room.
 * Tab order: section nav → close → section content.
 */
export function RoomSettingsScreen({
  room,
  section,
  liveUpdatesPaused,
  className,
}: RoomSettingsScreenProps) {
  const isMobile = useIsMobile()
  const { id: roomId, name: roomName, icon } = room.room
  useEscapeToClose(roomId, room.defaultChannelId)

  // UI-only gate; hideout-api enforces the role on every settings mutation (403 is handled).
  if (room.myRole === 'member') {
    return (
      <SettingsForbidden
        roomId={roomId}
        roomName={roomName}
        defaultChannelId={room.defaultChannelId}
      />
    )
  }

  const roomHeading = (
    <div className="flex min-w-0 items-center gap-2.5">
      <RoomIcon icon={icon} name={roomName} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{roomName}</p>
        <p className="text-xs text-muted-foreground">Room settings</p>
      </div>
    </div>
  )

  const close = (
    <SettingsCloseButton
      roomId={roomId}
      channelId={room.defaultChannelId}
      showCaption={!isMobile}
    />
  )

  return (
    <div className={cn('flex min-h-svh flex-col bg-background md:flex-row', className)}>
      {isMobile ? (
        <header className="sticky top-0 z-10 border-b border-sidebar-border bg-sidebar">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            {roomHeading}
            {close}
          </div>
          <SettingsNav roomId={roomId} section={section} orientation="horizontal" />
        </header>
      ) : (
        <aside
          aria-label={`${roomName} settings`}
          className="flex w-64 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4"
        >
          {roomHeading}
          <SettingsNav roomId={roomId} section={section} />
        </aside>
      )}

      <main className="min-w-0 flex-1">
        {/* Its own row at the top of <main>: it follows the section nav in the tab order and
            can never overlap the content, whatever the width. */}
        {!isMobile && <div className="flex justify-end px-6 pt-6">{close}</div>}
        <div className="mx-auto max-w-xl px-4 py-8 md:px-6 md:pt-2 md:pb-12">
          {liveUpdatesPaused && (
            <ConnectionBanner
              title="Live updates paused, retrying…"
              description="Changes others make to this room may not show until the connection is back."
              className="mb-6"
            />
          )}
          {section === 'overview' && <OverviewSection key={roomId} room={room} />}
          {section === 'members' && <MembersSection room={room} />}
          {section === 'invites' && <InvitesSection room={room} />}
          {section === 'channels' && <ChannelsSection room={room} />}
        </div>
      </main>
    </div>
  )
}
