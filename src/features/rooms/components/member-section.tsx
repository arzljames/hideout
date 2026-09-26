import { useId } from 'react'
import { cn } from '@/lib/utils'
import type { Member } from '../types'
import { MemberRow } from './member-row'

interface MemberSectionProps {
  title: string
  members: Member[]
  /** The signed-in user's profile id, to mark their row "(you)". */
  viewerId: string | undefined
  className?: string
}

/** A titled group of members ("Admins — 2"). Renders nothing when empty. */
export function MemberSection({ title, members, viewerId, className }: MemberSectionProps) {
  const headingId = useId()
  if (members.length === 0) return null

  return (
    <section aria-labelledby={headingId} className={cn(className)}>
      <h2
        id={headingId}
        className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        {title} — {members.length}
      </h2>
      <ul role="list" className="flex flex-col gap-0.5">
        {members.map((member) => (
          <MemberRow key={member.user.id} member={member} isViewer={member.user.id === viewerId} />
        ))}
      </ul>
    </section>
  )
}
