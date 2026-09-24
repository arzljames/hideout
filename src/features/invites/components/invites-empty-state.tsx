import { Inbox } from 'lucide-react'
import type { Ref } from 'react'
import { CenteredState } from '@/components/centered-state'

interface InvitesEmptyStateProps {
  /** Focus target after the last invite is handled (the heading gets tabIndex -1). */
  titleRef?: Ref<HTMLHeadingElement>
  className?: string
}

/** Nothing waiting in the Invites inbox. */
export function InvitesEmptyState({ titleRef, className }: InvitesEmptyStateProps) {
  return (
    <CenteredState
      className={className}
      tone="muted"
      icon={<Inbox aria-hidden="true" />}
      title="No pending invites"
      description="When someone invites you to a room, it shows up here."
      titleRef={titleRef}
    />
  )
}
