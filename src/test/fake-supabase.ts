import { vi } from 'vitest'

type StatusCallback = (status: string, error?: Error) => void
type BroadcastCallback = (message: { type: 'broadcast'; event: string; payload: unknown }) => void

/**
 * A stand-in for a supabase-js RealtimeChannel. Tests drive it with `emitStatus` and
 * `emitBroadcast`; nothing touches the network.
 */
export class FakeChannel {
  readonly topic: string
  readonly subTopic: string
  readonly params: { config?: { private?: boolean } }
  readonly bindings: Array<{ filter: { event: string }; callback: BroadcastCallback }> = []
  statusCallback: StatusCallback | undefined
  subscribeCalls = 0
  removed = false

  constructor(subTopic: string, params: FakeChannel['params']) {
    this.subTopic = subTopic
    this.topic = `realtime:${subTopic}`
    this.params = params
  }

  on(_type: 'broadcast', filter: { event: string }, callback: BroadcastCallback) {
    this.bindings.push({ filter, callback })
    return this
  }

  subscribe(callback?: StatusCallback) {
    this.subscribeCalls += 1
    this.statusCallback = callback
    return this
  }

  emitStatus(status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED', error?: Error) {
    this.statusCallback?.(status, error)
  }

  /** Deliver a broadcast the way realtime-js does: `{ type, event, payload }`, event-filtered. */
  emitBroadcast(event: string, payload: unknown) {
    for (const { filter, callback } of this.bindings) {
      if (filter.event === '*' || filter.event.toLowerCase() === event.toLowerCase()) {
        callback({ type: 'broadcast', event, payload })
      }
    }
  }
}

/** The parts of the supabase-js client the app uses for Realtime. */
export class FakeSupabase {
  channels: FakeChannel[] = []
  /** Every channel ever created, including removed ones. */
  created: FakeChannel[] = []
  realtime = {
    setAuth: vi.fn(async (_token?: string | null) => {}),
    disconnect: vi.fn(async () => 'ok' as const),
  }

  channel = vi.fn((subTopic: string, params: FakeChannel['params'] = {}) => {
    // Like realtime-js: an existing channel for the topic is returned as is.
    const existing = this.channels.find((c) => c.subTopic === subTopic)
    if (existing) return existing
    const channel = new FakeChannel(subTopic, params)
    this.channels.push(channel)
    this.created.push(channel)
    return channel
  })

  getChannels = () => [...this.channels]

  removeChannel = vi.fn(async (channel: FakeChannel) => {
    await Promise.resolve()
    channel.removed = true
    this.channels = this.channels.filter((c) => c !== channel)
    return 'ok' as const
  })

  removeAllChannels = vi.fn(async () => {
    const all = this.channels
    this.channels = []
    for (const channel of all) channel.removed = true
    return all.map(() => 'ok' as const)
  })

  /** Live channels for a topic (without the `realtime:` prefix). */
  channelsFor(subTopic: string) {
    return this.channels.filter((c) => c.subTopic === subTopic)
  }

  reset() {
    this.channels = []
    this.created = []
    this.realtime.setAuth.mockClear()
    this.realtime.disconnect.mockClear()
    this.channel.mockClear()
    this.removeChannel.mockClear()
    this.removeAllChannels.mockClear()
  }
}

/** The instance `@/lib/supabase` resolves to in tests (mocked in setup.ts). */
export const fakeSupabase = new FakeSupabase()
