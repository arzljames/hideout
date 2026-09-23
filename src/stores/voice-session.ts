import { create } from 'zustand'

type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error'

interface VoiceSessionState {
  status: VoiceStatus
  roomName: string | null
  token: string | null
  join: (roomName: string, token: string) => void
  setStatus: (status: VoiceStatus) => void
  leave: () => void
}

/** UI state for the active voice session; outlives route changes. */
export const useVoiceSession = create<VoiceSessionState>()((set) => ({
  status: 'idle',
  roomName: null,
  token: null,
  join: (roomName, token) => set({ roomName, token, status: 'connecting' }),
  setStatus: (status) => set({ status }),
  leave: () => set({ roomName: null, token: null, status: 'idle' }),
}))
