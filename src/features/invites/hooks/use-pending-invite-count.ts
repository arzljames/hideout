import { useQuery } from '@tanstack/react-query'
import { inboxQueryOptions } from '../api'
import { isInboxInviteLive } from '../invite-cache'

/** Number of pending (unexpired) direct invites, for badges. 0 while loading or on error. */
export function usePendingInviteCount(): number {
  const { data } = useQuery(inboxQueryOptions)
  return data?.filter((invite) => isInboxInviteLive(invite)).length ?? 0
}
