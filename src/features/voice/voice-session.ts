import type {
  ConnectionQuality,
  LocalAudioTrack,
  Participant,
  RemoteParticipant,
  RemoteTrack,
  Room,
  RoomEventCallbacks,
} from 'livekit-client'
import { toast } from 'sonner'
import { create } from 'zustand'
import { ApiError } from '@/lib/api/client'
import { fetchVoiceToken } from './api'
import type { MicGainProcessor } from './lib/mic-gain'
import {
  DEFAULT_VOICE_PREFS,
  loadVoicePrefs,
  saveVoicePrefs,
  type VoiceInputMode,
  type VoicePrefs,
} from './voice-prefs'

/*
 * The voice session: one LiveKit Room for the whole app, held in this module (never in React
 * state), so it survives route changes. The Zustand store mirrors what the UI needs. LiveKit is
 * loaded on the first join (dynamic import), so it stays out of the main bundle.
 * Tokens are only ever local variables of `join`: fetched right before `room.connect`, never kept.
 */

type LiveKit = typeof import('livekit-client')

export type VoiceStatus =
  | 'idle'
  | 'requesting-mic'
  | 'mic-denied'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  /** Left unexpectedly or couldn't join; `error` says why. */
  | 'disconnected'
  /** Removed by the server (removed from the room, channel or room deleted). */
  | 'kicked'

export type VoiceQuality = 'good' | 'poor' | 'lost'

export interface VoiceTarget {
  roomId: string
  roomName: string
  channelId: string
  channelName: string
}

export interface VoiceSessionState extends VoicePrefs {
  status: VoiceStatus
  roomId: string | null
  roomName: string | null
  channelId: string | null
  channelName: string | null
  muted: boolean
  deafened: boolean
  /** Mute state to restore when undeafening (deafen implies muted, Discord-style). */
  mutedBeforeDeafen: boolean
  /** The push-to-talk key is held. */
  pttActive: boolean
  /** Whether the published mic is actually open (from LiveKit's local TrackMuted/Unmuted). */
  micOpen: boolean
  /** Lowercased identities (profile ids) of who's speaking in the joined channel. */
  speakingIds: string[]
  quality: VoiceQuality | null
  /** The browser blocked audio playback until a click (see startAudio). */
  audioBlocked: boolean
  error?: string
}

export type JoinResult =
  | { outcome: 'joined' }
  /** A later join or leave replaced this one. */
  | { outcome: 'cancelled' }
  | { outcome: 'failed'; error: unknown }

interface VoiceSessionActions {
  /** Join a voice channel, leaving the current one first. Joining the current one is a no-op. */
  join: (target: VoiceTarget) => Promise<JoinResult>
  leave: () => Promise<void>
  toggleMute: () => void
  toggleDeafen: () => void
  setPttActive: (active: boolean) => void
  setInputMode: (inputMode: VoiceInputMode) => void
  setInputDevice: (deviceId: string) => Promise<void>
  setOutputDevice: (deviceId: string) => Promise<void>
  setInputVolume: (inputVolume: number) => void
  setPttKey: (code: string) => void
  /** Resume audio playback the browser blocked; call from a click handler. */
  startAudio: () => Promise<void>
}

export type VoiceSession = VoiceSessionState & VoiceSessionActions

/** Statuses where a session for `channelId` exists or is being set up. */
export const ACTIVE_STATUSES: ReadonlySet<VoiceStatus> = new Set([
  'requesting-mic',
  'connecting',
  'connected',
  'reconnecting',
])

export const VOICE_MESSAGES = {
  connectFailed: "Couldn't join voice, try again in a minute.",
  rateLimited: 'Slow down. Try again in a moment.',
  channelGone: "This voice channel isn't available anymore.",
  notVoice: 'This is not a voice channel.',
  offline: "Couldn't reach Hideout. Check your connection and try again.",
  joinFailed: "Couldn't join voice. Try again.",
  noMic: 'No microphone found. Plug one in and try again.',
  micInUse: 'Your microphone is being used by another app. Close it and try again.',
  micFailed: "Couldn't start your microphone. Try again.",
  kicked: 'You were disconnected from voice.',
  lost: 'Lost connection to voice.',
  elsewhere: 'You joined voice somewhere else, so you left it here.',
} as const

const NO_SESSION = {
  roomId: null,
  roomName: null,
  channelId: null,
  channelName: null,
  pttActive: false,
  micOpen: false,
  speakingIds: [] as string[],
  quality: null,
  audioBlocked: false,
  error: undefined,
} satisfies Partial<VoiceSessionState>

function initialState(prefs: VoicePrefs): VoiceSessionState {
  return {
    ...prefs,
    ...NO_SESSION,
    status: 'idle',
    muted: false,
    deafened: false,
    mutedBeforeDeafen: false,
  }
}

// --- The LiveKit session (module state) -----------------------------------------------------

let room: Room | null = null
let micTrack: LocalAudioTrack | null = null
let micPublished = false
let micGain: { processor: MicGainProcessor; context: AudioContext } | null = null
/** The gain processor being set up (one per track), and the latest gain asked for. */
let micGainSetup: Promise<void> | null = null
let desiredGain = 1
/**
 * `room.connect` resolved. Until then a Disconnected event belongs to the failing connect
 * (LiveKit emits it before rejecting), which join's own catch reports.
 */
let roomConnected = false
let unwire: (() => void) | null = null
/** Bumped by every join and leave; an async step that sees a newer value stops. */
let joinSeq = 0

/** Stop listening, stop the mic, remove audio elements, and disconnect. Idempotent. */
async function teardown(): Promise<void> {
  const current = room
  const track = micTrack
  const gain = micGain
  const stopListening = unwire
  room = null
  micTrack = null
  micPublished = false
  roomConnected = false
  micGain = null
  unwire = null
  // Listeners first, so our own disconnect isn't handled as an unexpected one.
  stopListening?.()
  track?.stop()
  void gain?.context.close().catch(() => {})
  if (current) {
    try {
      await current.disconnect()
    } catch {
      // Already disconnected.
    }
  }
}

function micShouldBeOpen(s: VoiceSessionState): boolean {
  return !s.muted && !s.deafened && (s.inputMode === 'voice-activity' || s.pttActive)
}

/** Open or close the mic to match the store. Before publishing, the track is muted in place. */
async function applyMic(state: VoiceSessionState): Promise<void> {
  const track = micTrack
  if (!track) return
  try {
    if (micShouldBeOpen(state)) await track.unmute()
    else await track.mute()
  } catch {
    // The track ended (e.g. device unplugged); LiveKit reports it via MediaDevicesError.
  }
}

/** Deafen: silence every remote participant (kept by LiveKit for tracks subscribed later). */
function applyDeafen(deafened: boolean): void {
  if (!room) return
  for (const participant of room.remoteParticipants.values()) {
    participant.setVolume(deafened ? 0 : 1)
  }
}

async function applyInputVolume(inputVolume: number): Promise<void> {
  desiredGain = inputVolume / 100
  const track = micTrack
  if (!track) return
  if (micGain) {
    micGain.processor.setGain(desiredGain)
    return
  }
  // Already being set up: it picks up `desiredGain`. At 100% no processing is needed: the
  // untouched browser track is the most reliable path.
  if (micGainSetup || inputVolume === 100) return
  micGainSetup = (async () => {
    try {
      const { MicGainProcessor } = await import('./lib/mic-gain')
      if (track !== micTrack) return
      const context = new AudioContext()
      const processor = new MicGainProcessor(desiredGain)
      micGain = { processor, context }
      track.setAudioContext(context)
      await track.setProcessor(processor)
      // Slider moves while attaching went through setGain already; this covers a race.
      processor.setGain(desiredGain)
    } catch {
      // Web Audio unavailable: the mic keeps working at its natural level.
    } finally {
      micGainSetup = null
    }
  })()
  await micGainSetup
}

function sameId(a: string | null, b: string) {
  return a !== null && a.toLowerCase() === b.toLowerCase()
}

function toQuality(lk: LiveKit, quality: ConnectionQuality): VoiceQuality | null {
  switch (quality) {
    case lk.ConnectionQuality.Excellent:
    case lk.ConnectionQuality.Good:
      return 'good'
    case lk.ConnectionQuality.Poor:
      return 'poor'
    case lk.ConnectionQuality.Lost:
      return 'lost'
    default:
      return null
  }
}

function tokenErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return VOICE_MESSAGES.joinFailed
  if (error.code === 'NETWORK') return VOICE_MESSAGES.offline
  if (error.status === 429) return VOICE_MESSAGES.rateLimited
  if (error.status === 404) return VOICE_MESSAGES.channelGone
  if (error.status === 409) return VOICE_MESSAGES.notVoice
  return VOICE_MESSAGES.joinFailed
}

// --- Store ----------------------------------------------------------------------------------

export const useVoiceSession = create<VoiceSession>()((set, get) => {
  function setPrefs(patch: Partial<VoicePrefs>) {
    set(patch)
    saveVoicePrefs(get())
  }

  /** The session ended without us leaving: clean up and show why. */
  function endUnexpectedly(status: 'kicked' | 'disconnected' | 'mic-denied', error?: string) {
    joinSeq += 1
    void teardown()
    if (status === 'kicked') {
      set({ ...NO_SESSION, status: 'kicked' })
      toast(VOICE_MESSAGES.kicked)
      return
    }
    // Keep the channel so its page can show the problem and offer a retry.
    const { roomId, roomName, channelId, channelName } = get()
    set({ ...NO_SESSION, status, error, roomId, roomName, channelId, channelName })
    if (status === 'disconnected' && error) toast.error(error)
  }

  /** Subscribe to the Room's events; returns the unsubscribe. */
  function wire(lk: LiveKit, lkRoom: Room): () => void {
    const offs: (() => void)[] = []
    const audioElements = new Set<HTMLMediaElement>()
    function on<E extends keyof RoomEventCallbacks>(event: E, listener: RoomEventCallbacks[E]) {
      lkRoom.on(event, listener)
      offs.push(() => lkRoom.off(event, listener))
    }
    const isCurrent = () => room === lkRoom

    // LiveKit doesn't play remote audio by itself: attach each track to an audio element.
    on(lk.RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind !== lk.Track.Kind.Audio) return
      const element = track.attach()
      audioElements.add(element)
      document.body.appendChild(element)
    })
    on(lk.RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      for (const element of track.detach()) {
        audioElements.delete(element)
        element.remove()
      }
    })
    on(lk.RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      if (get().deafened) participant.setVolume(0)
    })
    on(lk.RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      const ids = speakers.map((speaker) => speaker.identity.toLowerCase())
      const current = get().speakingIds
      if (ids.length === current.length && ids.every((id, index) => id === current[index])) return
      set({ speakingIds: ids })
    })
    on(lk.RoomEvent.TrackMuted, (publication, participant) => {
      if (participant === lkRoom.localParticipant && publication.source === lk.Track.Source.Microphone) {
        set({ micOpen: false })
      }
    })
    on(lk.RoomEvent.TrackUnmuted, (publication, participant) => {
      if (participant === lkRoom.localParticipant && publication.source === lk.Track.Source.Microphone) {
        set({ micOpen: true })
      }
    })
    on(lk.RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      if (participant === lkRoom.localParticipant) set({ quality: toQuality(lk, quality) })
    })
    on(lk.RoomEvent.AudioPlaybackStatusChanged, () => {
      set({ audioBlocked: !lkRoom.canPlaybackAudio })
    })
    const onReconnecting = () => {
      if (isCurrent()) set({ status: 'reconnecting' })
    }
    on(lk.RoomEvent.Reconnecting, onReconnecting)
    on(lk.RoomEvent.SignalReconnecting, onReconnecting)
    on(lk.RoomEvent.Reconnected, () => {
      if (isCurrent()) set({ status: 'connected' })
    })
    on(lk.RoomEvent.MediaDevicesError, (error: Error, kind?: MediaDeviceKind) => {
      if (!isCurrent() || (kind && kind !== 'audioinput')) return
      if (lk.MediaDeviceFailure.getFailure(error) === lk.MediaDeviceFailure.PermissionDenied) {
        endUnexpectedly('mic-denied')
        return
      }
      toast.error(VOICE_MESSAGES.micFailed)
    })
    on(lk.RoomEvent.Disconnected, (reason) => {
      // Before connect resolves, join's catch handles the failure (and its message).
      if (!isCurrent() || !roomConnected) return
      switch (reason) {
        case lk.DisconnectReason.PARTICIPANT_REMOVED:
        case lk.DisconnectReason.ROOM_DELETED:
        case lk.DisconnectReason.ROOM_CLOSED:
          endUnexpectedly('kicked')
          return
        case lk.DisconnectReason.CLIENT_INITIATED:
          joinSeq += 1
          void teardown()
          set({ ...NO_SESSION, status: 'idle' })
          return
        case lk.DisconnectReason.DUPLICATE_IDENTITY:
          endUnexpectedly('disconnected', VOICE_MESSAGES.elsewhere)
          return
        default:
          endUnexpectedly('disconnected', VOICE_MESSAGES.lost)
      }
    })

    return () => {
      for (const off of offs) off()
      for (const element of audioElements) element.remove()
      audioElements.clear()
    }
  }

  return {
    ...initialState(loadVoicePrefs()),

    join: async (target) => {
      const current = get()
      if (sameId(current.channelId, target.channelId) && ACTIVE_STATUSES.has(current.status)) {
        return { outcome: 'joined' }
      }
      const seq = ++joinSeq
      const stale = () => seq !== joinSeq
      await teardown()
      if (stale()) return { outcome: 'cancelled' }
      set({ ...NO_SESSION, ...target, status: 'requesting-mic' })

      const fail = async (error: unknown, patch: Partial<VoiceSessionState>): Promise<JoinResult> => {
        if (stale()) return { outcome: 'cancelled' }
        joinSeq += 1
        await teardown()
        set(patch)
        return { outcome: 'failed', error }
      }

      let lk: LiveKit
      try {
        lk = await import('livekit-client')
      } catch (error) {
        return fail(error, { status: 'disconnected', error: VOICE_MESSAGES.joinFailed })
      }
      if (stale()) return { outcome: 'cancelled' }

      // 1. The mic, before the token: the permission prompt can outlast the token's 60 s.
      let track: LocalAudioTrack
      try {
        const { inputDevice } = get()
        track = await lk.createLocalAudioTrack({
          deviceId: inputDevice === 'default' ? undefined : inputDevice,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        })
      } catch (error) {
        const failure = lk.MediaDeviceFailure.getFailure(error)
        if (failure === lk.MediaDeviceFailure.PermissionDenied) {
          return fail(error, { status: 'mic-denied' })
        }
        const message =
          failure === lk.MediaDeviceFailure.NotFound
            ? VOICE_MESSAGES.noMic
            : failure === lk.MediaDeviceFailure.DeviceInUse
              ? VOICE_MESSAGES.micInUse
              : VOICE_MESSAGES.micFailed
        return fail(error, { status: 'disconnected', error: message })
      }
      if (stale()) {
        track.stop()
        return { outcome: 'cancelled' }
      }
      micTrack = track
      set({ status: 'connecting' })

      // 2. A fresh token, used at once.
      let token: string
      let url: string
      try {
        ;({ token, url } = await fetchVoiceToken(target.channelId))
      } catch (error) {
        // 401: the session ended; the global handler signs out, so stay quiet.
        if (error instanceof ApiError && error.status === 401) {
          return fail(error, { ...NO_SESSION, status: 'idle' })
        }
        return fail(error, { status: 'disconnected', error: tokenErrorMessage(error) })
      }
      if (stale()) return { outcome: 'cancelled' }

      // 3. Connect. Audio only; no camera, screen share or data.
      const lkRoom = new lk.Room({
        adaptiveStream: false,
        dynacast: false,
        audioOutput: { deviceId: get().outputDevice },
        disconnectOnPageLeave: true,
      })
      room = lkRoom
      unwire = wire(lk, lkRoom)
      try {
        await lkRoom.connect(url, token)
        if (room === lkRoom) roomConnected = true
      } catch (error) {
        // e.g. a re-invited member LiveKit still refuses for about a minute.
        return fail(error, { status: 'disconnected', error: VOICE_MESSAGES.connectFailed })
      }
      if (stale()) return { outcome: 'cancelled' }

      // 4. Publish the mic, muted in place if it shouldn't be open (muted, deafened, or PTT).
      try {
        await applyMic(get())
        await lkRoom.localParticipant.publishTrack(track, { source: lk.Track.Source.Microphone })
        micPublished = true
      } catch (error) {
        return fail(error, { status: 'disconnected', error: VOICE_MESSAGES.micFailed })
      }
      if (stale()) return { outcome: 'cancelled' }
      applyDeafen(get().deafened)
      void applyInputVolume(get().inputVolume)
      set({
        status: 'connected',
        micOpen: !track.isMuted,
        audioBlocked: !lkRoom.canPlaybackAudio,
      })
      return { outcome: 'joined' }
    },

    leave: async () => {
      joinSeq += 1
      set({ ...NO_SESSION, status: 'idle' })
      await teardown()
    },

    toggleMute: () => {
      set((state) =>
        // Unmuting while deafened also undeafens; you can't talk while you can't hear.
        state.deafened ? { deafened: false, muted: false } : { muted: !state.muted },
      )
      applyDeafen(get().deafened)
      void applyMic(get())
    },

    toggleDeafen: () => {
      set((state) =>
        state.deafened
          ? { deafened: false, muted: state.mutedBeforeDeafen }
          : { deafened: true, muted: true, mutedBeforeDeafen: state.muted },
      )
      applyDeafen(get().deafened)
      void applyMic(get())
    },

    setPttActive: (active) => {
      if (get().pttActive === active) return
      set({ pttActive: active })
      void applyMic(get())
    },

    setInputMode: (inputMode) => {
      set({ pttActive: false })
      setPrefs({ inputMode })
      void applyMic(get())
    },

    setInputDevice: async (deviceId) => {
      setPrefs({ inputDevice: deviceId })
      if (!room || !micPublished) return
      try {
        await room.switchActiveDevice('audioinput', deviceId)
      } catch {
        toast.error("Couldn't switch to that microphone.")
      }
    },

    setOutputDevice: async (deviceId) => {
      setPrefs({ outputDevice: deviceId })
      if (!room) return
      try {
        await room.switchActiveDevice('audiooutput', deviceId)
      } catch {
        toast.error("Couldn't switch to those speakers.")
      }
    },

    setInputVolume: (value) => {
      const inputVolume = Math.round(Math.min(100, Math.max(0, value)))
      setPrefs({ inputVolume })
      void applyInputVolume(inputVolume)
    },

    setPttKey: (code) => setPrefs({ pttKey: code }),

    startAudio: async () => {
      if (!room) return
      try {
        await room.startAudio()
        set({ audioBlocked: !room.canPlaybackAudio })
      } catch {
        // Still blocked; the button stays.
      }
    },
  }
})

/** The local mic track while in voice (for the level meter). */
export function getLocalMicTrack(): LocalAudioTrack | null {
  return micTrack
}

/** Join a voice channel (leaving the current one first). */
export function joinVoice(target: VoiceTarget): Promise<JoinResult> {
  return useVoiceSession.getState().join(target)
}

/** Leave voice, whatever the state. */
export function leaveVoice(): Promise<void> {
  return useVoiceSession.getState().leave()
}

/**
 * Leave voice if the session (or a failed join's leftover state) is in this room, and in this
 * channel when given: for a deleted channel or room, or a room we were removed from.
 */
export function leaveVoiceIn({ roomId, channelId }: { roomId: string; channelId?: string }): void {
  const state = useVoiceSession.getState()
  if (state.status === 'idle' || !sameId(state.roomId, roomId)) return
  if (channelId !== undefined && !sameId(state.channelId, channelId)) return
  void state.leave()
}

/** Sign-out: leave voice and forget this session's mute/deafen (device prefs stay). */
export function endVoiceSession(): void {
  void leaveVoice()
  useVoiceSession.setState({ muted: false, deafened: false, mutedBeforeDeafen: false })
}

/** Back to defaults, disconnected (for tests). */
export function resetVoiceStore(): void {
  joinSeq += 1
  void teardown()
  useVoiceSession.setState(initialState(DEFAULT_VOICE_PREFS))
}
