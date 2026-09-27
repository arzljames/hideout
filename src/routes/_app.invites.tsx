import { createFileRoute } from '@tanstack/react-router'
import { inboxQueryOptions, InvitesInbox, InvitesInboxError, InvitesInboxSkeleton } from '@/features/invites'

export const Route = createFileRoute('/_app/invites')({
  loader: ({ context }) => context.queryClient.ensureQueryData(inboxQueryOptions),
  pendingComponent: InvitesInboxSkeleton,
  errorComponent: ({ error }) => <InvitesInboxError error={error} />,
  component: InvitesInbox,
})
