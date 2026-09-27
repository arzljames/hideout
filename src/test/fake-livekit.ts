import { vi } from 'vitest'

/*
 * A stand-in for livekit-client's Room, local mic track and helpers. `vi.mock('livekit-client')`
 * in setup.ts keeps the real enums (RoomEvent, DisconnectReason, Track, MediaDeviceFailure, …)
 * and swaps in these fakes, so no test ever opens a real connection or touches a real device.
 * Tests drive LiveKit's side with `room.emit(RoomEvent.X, …)` and the `fakeLiveKit` knobs.
 * This module must not import livekit-client at runtime (it's used inside that mock).
 */

type Listener = (...args: unknown[]) => void

export interface Deferred<T = void> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

/** A promise the test settles, to hold an async step (mic prompt, connect) mid-flight. */
export function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** The parts of AudioProcessorOptions / TrackProcessor the fake track uses. */
interface FakeProcessor {
  init: (options: { track: MediaStreamTrack; audioContext: AudioContext }) => Promise<void>
}

/** The local mic (LocalAudioTrack): mute state, stop, and the gain processor hooks. */
export class FakeMicTrack {
  readonly kind = 'audio'
  readonly options: unknown
  isMuted = false
  stopped = false
  audioContext: AudioContext | undefined
  processor: FakeProcessor | undefined
  stop = vi.fn(() => {
    this.stopped = true
  })
  mute = vi.fn(async () => {
    this.isMuted = true
  })
  unmute = vi.fn(async () => {
    this.isMuted = false
  })
  setAudioContext = vi.fn((context: AudioContext) => {
    this.audioContext = context
  })
  /** Like LiveKit: runs the processor's init with the track's AudioContext. */
  setProcessor = vi.fn(async (processor: FakeProcessor) => {
    this.processor = processor
    if (this.audioContext) {
      await processor.init({ track: {} as MediaStreamTrack, audioContext: this.audioContext })
    }
  })

  constructor(options?: unknown) {
    this.options = options
  }
}

/** A remote participant's track, as TrackSubscribed delivers it. */
export class FakeRemoteTrack {
  readonly kind: 'audio' | 'video'
  readonly elements: HTMLMediaElement[] = []
  attach = vi.fn(() => {
    const element = document.createElement(this.kind)
    this.elements.push(element)
    return element
  })
  detach = vi.fn(() => this.elements.splice(0))

  constructor(kind: 'audio' | 'video' = 'audio') {
    this.kind = kind
  }
}

export class FakeRemoteParticipant {
  readonly identity: string
  setVolume = vi.fn()

  constructor(identity: string) {
    this.identity = identity
  }
}

function device(kind: MediaDeviceKind, deviceId: string, label: string) {
  return { kind, deviceId, label, groupId: '' } as MediaDeviceInfo
}

/** What Room.getLocalDevices lists by default ('default' aliases a real device). */
export const defaultFakeDevices: Record<'audioinput' | 'audiooutput', MediaDeviceInfo[]> = {
  audioinput: [
    device('audioinput', 'default', 'Default - Headset mic'),
    device('audioinput', 'headset-mic', 'Headset mic'),
    device('audioinput', 'usb-mic', 'USB condenser mic'),
    device('audioinput', 'webcam-mic', 'Webcam microphone'),
  ],
  audiooutput: [
    device('audiooutput', 'headset', 'Headset'),
    device('audiooutput', 'monitor', 'Monitor speakers'),
  ],
}

export { device as fakeDevice }

interface ConnectPlan {
  /** Reject with this. */
  error?: Error
  /** Like livekit-client: a failed join emits Disconnected (with this reason) before rejecting. */
  disconnectReason?: number
  /** Resolve (or fail) only once this settles. */
  hold?: Promise<void>
}

interface MicPlan {
  error?: Error
  hold?: Promise<void>
}

export class FakeRoom {
  static instances: FakeRoom[] = []
  /** Consumed by the next connect() of any room. */
  static nextConnect: ConnectPlan | null = null
  static getLocalDevices = vi.fn(
    async (kind: MediaDeviceKind, _requestPermissions?: boolean): Promise<MediaDeviceInfo[]> =>
      kind === 'audioinput' || kind === 'audiooutput' ? fakeLiveKit.devices[kind] : [],
  )

  readonly options: unknown
  readonly listeners = new Map<string, Set<Listener>>()
  remoteParticipants = new Map<string, FakeRemoteParticipant>()
  canPlaybackAudio = true
  /** startAudio() unblocks playback unless this is set. */
  startAudioFails = false
  localParticipant = {
    identity: '',
    publishTrack: vi.fn(async (_track: unknown, _options?: unknown) => {
      fakeLiveKit.calls.push('publish')
      return {}
    }),
    setMicrophoneEnabled: vi.fn(),
    setCameraEnabled: vi.fn(),
    setScreenShareEnabled: vi.fn(),
  }
  connect = vi.fn(async (_url: string, _token: string) => {
    fakeLiveKit.calls.push(`connect ${this.index}`)
    const plan = FakeRoom.nextConnect
    FakeRoom.nextConnect = null
    if (plan?.hold) await plan.hold
    if (plan?.error) {
      if (plan.disconnectReason !== undefined) this.emit('disconnected', plan.disconnectReason)
      throw plan.error
    }
  })
  disconnect = vi.fn(async () => {
    fakeLiveKit.calls.push(`disconnect ${this.index}`)
  })
  switchActiveDevice = vi.fn(async (_kind: MediaDeviceKind, _deviceId: string) => true)
  startAudio = vi.fn(async () => {
    if (this.startAudioFails) throw new Error('NotAllowedError')
    this.canPlaybackAudio = true
  })

  constructor(options?: unknown) {
    this.options = options
    FakeRoom.instances.push(this)
  }

  get index() {
    return FakeRoom.instances.indexOf(this)
  }

  on(event: string, listener: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(listener)
    return this
  }

  off(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener)
    return this
  }

  emit(event: string, ...args: unknown[]) {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener(...args)
  }

  /** How many listeners are attached, over every event. */
  get listenerCount() {
    let count = 0
    for (const set of this.listeners.values()) count += set.size
    return count
  }
}

/** Web Audio stand-in for the mic gain processor (jsdom has no AudioContext). */
export class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  readonly gainNodes: { gain: { value: number } }[] = []
  closed = false
  close = vi.fn(async () => {
    this.closed = true
  })

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  createMediaStreamSource() {
    return { connect: <T>(node: T) => node, disconnect: vi.fn() }
  }

  createGain() {
    const node = { gain: { value: 1 }, connect: <T>(next: T) => next, disconnect: vi.fn() }
    this.gainNodes.push(node)
    return node
  }

  createMediaStreamDestination() {
    return { stream: { getAudioTracks: () => [{ stop: vi.fn() }] } }
  }
}

/** Install FakeAudioContext (and the MediaStream it needs) for one test; undone by unstubAll. */
export function stubWebAudio() {
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal(
    'MediaStream',
    class {
      readonly tracks: unknown[]
      constructor(tracks: unknown[] = []) {
        this.tracks = tracks
      }
    },
  )
}

export const fakeLiveKit = {
  /** Order of the steps a join takes: 'mic', 'token' (from MSW), 'connect n', 'publish', 'disconnect n'. */
  calls: [] as string[],
  tracks: [] as FakeMicTrack[],
  FakeRoom,
  devices: { ...defaultFakeDevices },
  /** Consumed by the next createLocalAudioTrack. */
  nextMic: null as MicPlan | null,
  /** What the level meter's analyser reports (0 to 1). */
  micVolume: 0,
  analysers: [] as { cleanup: ReturnType<typeof vi.fn> }[],

  createLocalAudioTrack: vi.fn(async (options?: unknown) => {
    fakeLiveKit.calls.push('mic')
    const plan = fakeLiveKit.nextMic
    fakeLiveKit.nextMic = null
    if (plan?.hold) await plan.hold
    if (plan?.error) throw plan.error
    const track = new FakeMicTrack(options)
    fakeLiveKit.tracks.push(track)
    return track
  }),

  createAudioAnalyser: vi.fn(() => {
    const analyser = {
      calculateVolume: () => fakeLiveKit.micVolume,
      cleanup: vi.fn(async () => {}),
    }
    fakeLiveKit.analysers.push(analyser)
    return analyser
  }),

  /** The latest room created by a join. */
  get room(): FakeRoom {
    const room = FakeRoom.instances.at(-1)
    if (!room) throw new Error('No LiveKit room was created')
    return room
  },

  /** The latest mic track created by a join. */
  get mic(): FakeMicTrack {
    const track = fakeLiveKit.tracks.at(-1)
    if (!track) throw new Error('No mic track was created')
    return track
  },

  reset() {
    fakeLiveKit.calls.length = 0
    fakeLiveKit.tracks.length = 0
    fakeLiveKit.analysers.length = 0
    fakeLiveKit.nextMic = null
    fakeLiveKit.micVolume = 0
    fakeLiveKit.devices = { ...defaultFakeDevices }
    FakeRoom.instances.length = 0
    FakeRoom.nextConnect = null
    FakeRoom.getLocalDevices.mockClear()
    FakeAudioContext.instances.length = 0
    fakeLiveKit.createLocalAudioTrack.mockClear()
    fakeLiveKit.createAudioAnalyser.mockClear()
  },
}

/** The livekit-client module for vi.mock: the real module with the fakes swapped in. */
export function fakeLiveKitModule<T extends object>(actual: T) {
  return {
    ...actual,
    Room: FakeRoom,
    createLocalAudioTrack: fakeLiveKit.createLocalAudioTrack,
    createAudioAnalyser: fakeLiveKit.createAudioAnalyser,
  }
}
