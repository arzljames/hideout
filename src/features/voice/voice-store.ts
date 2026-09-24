// TODO(livekit): drive `connection` from the LiveKit Room in the voice session; this store is
// UI state only (no tokens, no Room instance). voice-realtime-engineer owns the wiring.

import { create } from 'zustand'

export type VoiceInputMode = 'voice-activity' | 'push-to-talk'

/** The voice channel the user is in. Only the connected state is designed so far. */
export interface VoiceConnection {
  status: 'connected'
  roomId: string
  roomName: string
  channelId: string
  channelName: string
}

export interface VoiceState {
  connection: VoiceConnection | null
  muted: boolean
  deafened: boolean
  /** Mute state to restore when undeafening (deafen implies muted, Discord-style). */
  mutedBeforeDeafen: boolean
  inputMode: VoiceInputMode
  inputDevice: string
  outputDevice: string
  /** 0 to 100. */
  inputVolume: number
}

interface VoiceActions {
  toggleMute: () => void
  toggleDeafen: () => void
  setInputMode: (inputMode: VoiceInputMode) => void
  setInputDevice: (inputDevice: string) => void
  setOutputDevice: (outputDevice: string) => void
  setInputVolume: (inputVolume: number) => void
}

export const initialVoiceState: VoiceState = {
  // TODO(livekit): start disconnected; the sample session matches the design mock.
  connection: {
    status: 'connected',
    roomId: 'night-owls',
    roomName: 'Night Owls',
    channelId: 'voice',
    channelName: 'voice',
  },
  muted: false,
  deafened: false,
  mutedBeforeDeafen: false,
  inputMode: 'push-to-talk',
  inputDevice: 'default',
  outputDevice: 'default',
  inputVolume: 80,
}

export const useVoiceStore = create<VoiceState & VoiceActions>()((set) => ({
  ...initialVoiceState,
  toggleMute: () =>
    set((state) =>
      // Unmuting while deafened also undeafens; you can't talk while you can't hear.
      state.deafened ? { deafened: false, muted: false } : { muted: !state.muted },
    ),
  toggleDeafen: () =>
    set((state) =>
      state.deafened
        ? { deafened: false, muted: state.mutedBeforeDeafen }
        : { deafened: true, muted: true, mutedBeforeDeafen: state.muted },
    ),
  setInputMode: (inputMode) => set({ inputMode }),
  setInputDevice: (inputDevice) => set({ inputDevice }),
  setOutputDevice: (outputDevice) => set({ outputDevice }),
  setInputVolume: (inputVolume) => set({ inputVolume: Math.min(100, Math.max(0, inputVolume)) }),
}))

/** Restore the initial state (for tests and sign-out). */
export function resetVoiceStore() {
  useVoiceStore.setState(initialVoiceState)
}
