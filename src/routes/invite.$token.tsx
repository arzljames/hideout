import { createFileRoute } from '@tanstack/react-router'
import {
  InviteError,
  InviteInvalid,
  InviteScreen,
  InviteSkeleton,
  loadInvite,
} from '@/features/invites'

export const Route = createFileRoute('/invite/$token')({
  // Public: no auth guard. A 404 preview (any unusable link) throws notFound().
  loader: ({ context, params }) => loadInvite(context.queryClient, params.token),
  pendingComponent: InviteSkeleton,
  errorComponent: ({ error }) => <InviteError error={error} />,
  notFoundComponent: () => <InviteInvalid />,
  component: InviteRoute,
})

function InviteRoute() {
  const { token } = Route.useParams()
  return <InviteScreen token={token} />
}
