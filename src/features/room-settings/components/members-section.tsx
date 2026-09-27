import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { meQueryOptions } from '@/features/auth'
import { MemberActionDialogs, useMemberActions } from '@/features/members'
import { groupMembersByRole, type RoomDetail } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { MemberSettingsGroup } from './member-settings-group'
import { SettingsSectionHeader } from './settings-section-header'

interface MembersSectionProps {
  room: RoomDetail
  className?: string
}

/**
 * Members grouped Owner / Admins / Members, with local search and per-member actions.
 * TODO(perf): virtualize the list past ~200 members.
 */
export function MembersSection({ room, className }: MembersSectionProps) {
  const searchId = useId()
  const viewerId = useQuery(meQueryOptions).data?.id
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const actions = useMemberActions(room.room.id)
  const trimmed = query.trim().toLowerCase()
  const members = trimmed
    ? room.members.filter((member) => member.user.displayName.toLowerCase().includes(trimmed))
    : room.members
  const count = room.members.length
  // One status region, always mounted, so every change is announced: empty when unfiltered.
  const status = !trimmed
    ? ''
    : members.length > 0
      ? `${members.length} of ${count} members`
      : `No members match “${query.trim()}”`

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <SettingsSectionHeader
        title="Members"
        description={`${count} ${count === 1 ? 'member' : 'members'}`}
      />

      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          Search members
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={searchRef}
          id={searchId}
          type="search"
          placeholder="Search members"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-8"
        />
      </div>

      <p role="status" className="text-sm text-muted-foreground empty:hidden">
        {status}
      </p>

      {groupMembersByRole(members).map((group) => (
        <MemberSettingsGroup
          key={group.role}
          title={group.title}
          members={group.members}
          viewerId={viewerId}
          viewerRole={room.myRole}
          onAction={actions.run}
          busy={actions.changingRole}
        />
      ))}

      <MemberActionDialogs
        room={room}
        request={actions.request}
        open={actions.open}
        onOpenChange={actions.setOpen}
        // The removed member's row is gone: land on the search field.
        fallbackFocus={() => searchRef.current}
      />
    </div>
  )
}
