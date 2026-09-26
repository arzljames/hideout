import { createFileRoute } from '@tanstack/react-router'
import { InvitesInbox } from '@/features/invites'

export const Route = createFileRoute('/_app/invites')({
  // TODO(api): loader with ensureQueryData(pendingInvitesQueryOptions).
  component: InvitesInbox,
})
