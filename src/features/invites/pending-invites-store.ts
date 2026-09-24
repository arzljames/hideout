// TODO(api): server state belongs in TanStack Query (pending invites query + accept/decline
// mutations). This store only stands in for it while the page is design-only.

import { create } from 'zustand'
import { samplePendingInvites, type PendingInvite } from './sample-pending-invites'

interface PendingInvitesState {
  invites: PendingInvite[]
  accept: (id: string) => void
  decline: (id: string) => void
}

const initialState = { invites: samplePendingInvites }

export const usePendingInvitesStore = create<PendingInvitesState>()((set) => ({
  ...initialState,
  accept: (id) => set((state) => ({ invites: state.invites.filter((invite) => invite.id !== id) })),
  decline: (id) =>
    set((state) => ({ invites: state.invites.filter((invite) => invite.id !== id) })),
}))

/** Number of pending invites, for badges. */
export function usePendingInviteCount(): number {
  return usePendingInvitesStore((state) => state.invites.length)
}

/** Restore the initial state (for tests). */
export function resetPendingInvitesStore() {
  usePendingInvitesStore.setState(initialState)
}
