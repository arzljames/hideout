import { meFixture } from '@/test/fixtures/me'
import { fakeSupabase } from '@/test/fake-supabase'
import { server } from '@/test/msw/server'
import { getRealtimeStatus, startRealtime, stopRealtime } from './connection'
import { STUCK_AFTER_MS, subscribeTopic, type TopicListener, type TopicStatus } from './topics'

const TOPIC = 'room:a0000000-0000-4000-8000-000000000001'

function listener() {
  const statuses: TopicStatus[] = []
  const broadcasts: Array<[string, unknown]> = []
  const value: TopicListener = {
    onBroadcast: (event, payload) => broadcasts.push([event, payload]),
    onStatus: (status) => statuses.push(status),
  }
  return { value, statuses, broadcasts }
}

function onlyChannel() {
  const channels = fakeSupabase.channelsFor(TOPIC)
  expect(channels).toHaveLength(1)
  return channels[0]!
}

/** Flush microtasks (deferred releases, removals). */
async function flush() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}

beforeEach(async () => {
  startRealtime(meFixture.id)
  await vi.waitFor(() => expect(getRealtimeStatus()).toBe('ready'))
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  server.events.removeAllListeners()
})

describe('subscribeTopic', () => {
  it('joins one private channel per topic and fans broadcasts out to every listener', () => {
    const a = listener()
    const b = listener()
    subscribeTopic(TOPIC, a.value)
    subscribeTopic(TOPIC, b.value)

    const channel = onlyChannel()
    expect(channel.params).toEqual({ config: { private: true } })
    expect(channel.bindings.map((binding) => binding.filter)).toEqual([{ event: '*' }])
    expect(channel.subscribeCalls).toBe(1)

    channel.emitBroadcast('room:deleted', { id: 'x' })
    expect(a.broadcasts).toEqual([['room:deleted', { id: 'x' }]])
    expect(b.broadcasts).toEqual([['room:deleted', { id: 'x' }]])
  })

  it('removes the channel when the last listener leaves', async () => {
    const a = listener()
    const b = listener()
    const leaveA = subscribeTopic(TOPIC, a.value)
    const leaveB = subscribeTopic(TOPIC, b.value)
    const channel = onlyChannel()

    leaveA()
    await flush()
    expect(fakeSupabase.removeChannel).not.toHaveBeenCalled()

    leaveB()
    await flush()
    expect(fakeSupabase.removeChannel).toHaveBeenCalledWith(channel)
    expect(fakeSupabase.channelsFor(TOPIC)).toHaveLength(0)

    // Nothing reaches a listener that left.
    channel.emitBroadcast('room:deleted', {})
    expect(a.broadcasts).toEqual([])
  })

  it('reuses the channel across an unmount and remount in one tick (StrictMode)', async () => {
    const first = listener()
    subscribeTopic(TOPIC, first.value)()
    const second = listener()
    subscribeTopic(TOPIC, second.value)
    await flush()

    expect(fakeSupabase.removeChannel).not.toHaveBeenCalled()
    expect(fakeSupabase.created).toHaveLength(1)
    onlyChannel().emitBroadcast('room:updated', {})
    expect(second.broadcasts).toHaveLength(1)
  })

  it('waits for a leaving channel to be removed before joining the topic again', async () => {
    subscribeTopic(TOPIC, listener().value)()
    await flush()
    subscribeTopic(TOPIC, listener().value)
    await flush()

    expect(fakeSupabase.created).toHaveLength(2)
    expect(fakeSupabase.created[0]!.removed).toBe(true)
    expect(onlyChannel()).toBe(fakeSupabase.created[1])
  })

  it('reports subscribed, and afterError when it rejoins after a failure', () => {
    const a = listener()
    subscribeTopic(TOPIC, a.value)
    const channel = onlyChannel()

    channel.emitStatus('SUBSCRIBED')
    channel.emitStatus('CHANNEL_ERROR', new Error('socket closed'))
    channel.emitStatus('TIMED_OUT')
    channel.emitStatus('SUBSCRIBED')

    expect(a.statuses).toEqual([
      { type: 'subscribed', afterError: false },
      { type: 'subscribed', afterError: true },
    ])
    // supabase-js rejoins by itself: no new channel per error.
    expect(fakeSupabase.created).toHaveLength(1)
  })

  it('tells a late listener the topic is already subscribed', () => {
    subscribeTopic(TOPIC, listener().value)
    onlyChannel().emitStatus('SUBSCRIBED')

    const late = listener()
    subscribeTopic(TOPIC, late.value)
    expect(late.statuses).toEqual([{ type: 'subscribed', afterError: false }])
  })

  it('reports stuck after 30 s without SUBSCRIBED, then again with backoff up to 60 s', () => {
    const a = listener()
    subscribeTopic(TOPIC, a.value)

    vi.advanceTimersByTime(STUCK_AFTER_MS - 1)
    expect(a.statuses).toEqual([])
    vi.advanceTimersByTime(1)
    expect(a.statuses).toEqual([{ type: 'stuck' }])
    vi.advanceTimersByTime(60_000)
    expect(a.statuses).toHaveLength(2)
    vi.advanceTimersByTime(60_000)
    expect(a.statuses).toHaveLength(3)

    onlyChannel().emitStatus('SUBSCRIBED')
    vi.advanceTimersByTime(10 * 60_000)
    expect(a.statuses.at(-1)).toEqual({ type: 'subscribed', afterError: true })
    expect(a.statuses).toHaveLength(4)
  })

  it('reports stuck right away after 5 failed attempts in a row', () => {
    const a = listener()
    subscribeTopic(TOPIC, a.value)
    const channel = onlyChannel()

    for (let i = 0; i < 4; i += 1) channel.emitStatus('CHANNEL_ERROR')
    expect(a.statuses).toEqual([])
    channel.emitStatus('TIMED_OUT')
    expect(a.statuses).toEqual([{ type: 'stuck' }])
  })

  it('replaces a channel the server closed, after a backoff', async () => {
    const a = listener()
    subscribeTopic(TOPIC, a.value)
    const closed = onlyChannel()
    closed.emitStatus('SUBSCRIBED')

    closed.emitStatus('CLOSED')
    await flush()
    expect(closed.removed).toBe(true)
    expect(fakeSupabase.channelsFor(TOPIC)).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(2_000)
    const replacement = onlyChannel()
    expect(replacement).not.toBe(closed)
    replacement.emitStatus('SUBSCRIBED')
    expect(a.statuses.at(-1)).toEqual({ type: 'subscribed', afterError: true })
  })

  it('fetches a new token when a join fails with a JWT error', async () => {
    let tokenRequests = 0
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/auth/realtime-token') tokenRequests += 1
    })
    subscribeTopic(TOPIC, listener().value)
    // Past the 30 s throttle on forced refreshes.
    vi.advanceTimersByTime(31_000)

    onlyChannel().emitStatus('CHANNEL_ERROR', new Error('Unauthorized: JWT has expired'))
    await vi.waitFor(() => expect(tokenRequests).toBe(1))

    onlyChannel().emitStatus('CHANNEL_ERROR', new Error('network down'))
    await vi.advanceTimersByTimeAsync(0)
    expect(tokenRequests).toBe(1)
  })

  it('stopRealtime drops every topic: no timers, no callbacks, no recreate', async () => {
    const a = listener()
    const leave = subscribeTopic(TOPIC, a.value)
    const channel = onlyChannel()

    stopRealtime()
    channel.emitStatus('CLOSED')
    channel.emitBroadcast('room:deleted', {})
    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(a.statuses).toEqual([])
    expect(a.broadcasts).toEqual([])
    expect(fakeSupabase.created).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
    leave()
    await flush()
    expect(fakeSupabase.removeChannel).not.toHaveBeenCalled()
  })
})
