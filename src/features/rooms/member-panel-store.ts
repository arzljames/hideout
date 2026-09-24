import { create } from 'zustand'

interface MemberPanelState {
  /** Desktop (md and up): whether the inline member panel is shown. */
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

const initialState = { open: true }

/** Member panel visibility, shared by the room layout and the channel header toggle. */
export const useMemberPanelStore = create<MemberPanelState>()((set) => ({
  ...initialState,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
}))

/** Restore the initial state (for tests). */
export function resetMemberPanelStore() {
  useMemberPanelStore.setState(initialState)
}
