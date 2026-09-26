import { RoomIcon } from '@/components/room-icon'
import { useIsMobile } from '@/hooks/use-mobile'
import { getViewerRole, type Room } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { useEscapeToClose } from '../hooks/use-escape-to-close'
import { getSampleInviteLinks } from '../sample-invite-links'
import type { SettingsSection } from '../settings-sections'
import { ChannelsSection } from './channels-section'
import { InvitesSection } from './invites-section'
import { MembersSection } from './members-section'
import { OverviewSection } from './overview-section'
import { SettingsCloseButton } from './settings-close-button'
import { SettingsForbidden } from './settings-forbidden'
import { SettingsNav } from './settings-nav'

interface RoomSettingsScreenProps {
  room: Room
  section: SettingsSection
  className?: string
}

/**
 * Full-screen Room settings: section nav in a sidebar (a top bar with a scrolling nav row
 * below `md`), and the section in <main>. Esc or the round X goes back to the room.
 * Tab order: section nav → close → section content.
 */
export function RoomSettingsScreen({ room, section, className }: RoomSettingsScreenProps) {
  const isMobile = useIsMobile()
  useEscapeToClose(room.id, room.defaultChannelId)

  // UI-only gate; hideout-api must enforce the role on every settings mutation (expect 403 handling when wired).
  if (getViewerRole(room) === 'member') {
    return (
      <SettingsForbidden
        roomId={room.id}
        roomName={room.name}
        defaultChannelId={room.defaultChannelId}
      />
    )
  }

  const roomHeading = (
    <div className="flex min-w-0 items-center gap-2.5">
      <RoomIcon emoji={room.emoji} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{room.name}</p>
        <p className="text-xs text-muted-foreground">Room settings</p>
      </div>
    </div>
  )

  const close = (
    <SettingsCloseButton
      roomId={room.id}
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
          <SettingsNav roomId={room.id} section={section} orientation="horizontal" />
        </header>
      ) : (
        <aside
          aria-label={`${room.name} settings`}
          className="flex w-64 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4"
        >
          {roomHeading}
          <SettingsNav roomId={room.id} section={section} />
        </aside>
      )}

      <main className="min-w-0 flex-1">
        {/* Its own row at the top of <main>: it follows the section nav in the tab order and
            can never overlap the content, whatever the width. */}
        {!isMobile && <div className="flex justify-end px-6 pt-6">{close}</div>}
        <div className="mx-auto max-w-xl px-4 py-8 md:px-6 md:pt-2 md:pb-12">
          {section === 'overview' && <OverviewSection key={room.id} room={room} />}
          {section === 'members' && <MembersSection room={room} />}
          {section === 'invites' && (
            // TODO(api): roomInvitesQueryOptions(room.id), owner/admin only.
            <InvitesSection room={room} inviteLinks={getSampleInviteLinks(room.id)} />
          )}
          {section === 'channels' && <ChannelsSection room={room} />}
        </div>
      </main>
    </div>
  )
}
