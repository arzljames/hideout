import { Search } from 'lucide-react'
import { useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { getViewerRole, type Room } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { MemberSettingsRow } from './member-settings-row'
import { SettingsSectionHeader } from './settings-section-header'

interface MembersSectionProps {
  room: Room
  className?: string
}

/**
 * Members with local search, roles, and per-member actions.
 * TODO(perf): virtualize the list past ~200 members.
 */
export function MembersSection({ room, className }: MembersSectionProps) {
  const searchId = useId()
  const [query, setQuery] = useState('')
  const trimmed = query.trim().toLowerCase()
  const members = trimmed
    ? room.members.filter((member) => member.name.toLowerCase().includes(trimmed))
    : room.members
  const count = room.members.length
  const viewerRole = getViewerRole(room)
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

      {members.length > 0 && (
        <ul role="list" aria-label="Members" className="divide-y divide-border">
          {members.map((member) => (
            <MemberSettingsRow
              key={member.id}
              member={member}
              roomName={room.name}
              viewerRole={viewerRole}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
