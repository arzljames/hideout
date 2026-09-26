import { ApiError } from '@/lib/api/client'
import { fakeRealtimeJwt } from '@/test/fixtures/realtime-token'
import {
  BACKOFF_CAP_MS,
  createTokenManager,
  FOLLOWER_FIRST_TOKEN_TIMEOUT_MS,
  INITIAL_WAIT_MS,
  MAX_TOKEN_LIFETIME_MS,
  MIN_REFRESH_DELAY_MS,
  tokenChannelName,
  tokenLockName,
  tokenSubject,
  type ChannelLike,
  type LockManagerLike,
  type RealtimeToken,
  type TokenManagerOptions,
} from './token-manager'

const MINUTE = 60_000
const PROFILE = 'a1b2c3d4-0000-4000-8000-000000000001'
const OTHER_PROFILE = 'a1b2c3d4-0000-4000-8000-000000000002'
let issued = 0

/** An in-memory BroadcastChannel: delivers to every other open channel with the same name. */
class ChannelHub {
  channels = new Set<FakeBroadcastChannel>()
  open = (name: string) => new FakeBroadcastChannel(this, name)
}

class FakeBroadcastChannel implements ChannelLike {
  onmessage: ((event: MessageEvent) => void) | null = null
  closed = false
  readonly hub: ChannelHub
  readonly name: string

  constructor(hub: ChannelHub, name: string) {
    this.hub = hub
    this.name = name
    hub.channels.add(this)
  }

  postMessage(message: unknown) {
    if (this.closed) throw new Error('posted on a closed channel')
    const data = structuredClone(message)
    for (const other of this.hub.channels) {
      if (other === this || other.name !== this.name || other.closed) continue
      // Async, like the real thing.
      queueMicrotask(() => other.onmessage?.(new MessageEvent('message', { data })))
    }
  }

  close() {
    this.closed = true
    this.hub.channels.delete(this)
  }
}

/** An exclusive Web Lock: the first requester holds it, the rest queue in order. */
class FakeLocks implements LockManagerLike {
  holder: { release: () => void } | null = null
  queue: Array<() => void> = []
  requests: string[] = []

  request(name: string, options: { signal?: AbortSignal }, callback: () => Promise<void>) {
    this.requests.push(name)
    return new Promise<void>((resolve, reject) => {
      const grant = () => {
        this.queue = this.queue.filter((entry) => entry !== grant)
        let released = false
        const release = () => {
          if (released) return
          released = true
          this.holder = null
          this.queue[0]?.()
        }
        this.holder = { release }
        callback().then(release, release)
        resolve()
      }
      options.signal?.addEventListener('abort', () => {
        if (this.queue.includes(grant)) {
          this.queue = this.queue.filter((entry) => entry !== grant)
          reject(new DOMException('Aborted', 'AbortError'))
        }
      })
      this.queue.push(grant)
      if (!this.holder && this.queue[0] === grant) grant()
    })
  }
}

function tokenValidFor(ms: number, sub = PROFILE): RealtimeToken {
  issued += 1
  return {
    token: fakeRealtimeJwt(sub, { jti: issued }),
    expiresAt: new Date(Date.now() + ms).toISOString(),
  }
}

function apiError(status: number) {
  return new ApiError(status, status === 429 ? 'RATE_LIMITED' : 'ERROR', 'failed')
}

interface TabOptions extends Partial<TokenManagerOptions> {
  hub?: ChannelHub
  sharedLocks?: FakeLocks
}

function tab({ hub, sharedLocks, ...options }: TabOptions = {}) {
  const fetchToken = vi.fn(async () => tokenValidFor(15 * MINUTE))
  const onToken = vi.fn<(token: string) => void>()
  const manager = createTokenManager({
    profileId: PROFILE,
    fetchToken,
    onToken,
    locks: sharedLocks ?? null,
    openChannel: hub ? hub.open : () => null,
    random: () => 0.5,
    ...options,
  })
  return { manager, fetchToken: (options.fetchToken as typeof fetchToken) ?? fetchToken, onToken }
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-09-27T10:00:00.000Z') })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('a single tab (no locks or BroadcastChannel)', () => {
  it('fetches on start and hands the token over', async () => {
    const { manager, fetchToken, onToken } = tab()
    manager.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchToken).toHaveBeenCalledTimes(1)
    expect(onToken).toHaveBeenCalledWith(manager.current()!.token)
    manager.stop()
  })

  it('is idempotent: starting twice fetches once', async () => {
    const { manager, fetchToken } = tab()
    manager.start()
    manager.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchToken).toHaveBeenCalledTimes(1)
    manager.stop()
  })

  it('refreshes 60 s before expiresAt', async () => {
    const { manager, fetchToken, onToken } = tab()
    manager.start()
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(14 * MINUTE - 1)
    expect(fetchToken).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchToken).toHaveBeenCalledTimes(2)
    expect(onToken).toHaveBeenCalledTimes(2)
    manager.stop()
  })

  it('clamps the refresh delay to at least 5 s for short-lived tokens', async () => {
    const fetchToken = vi.fn(async () => tokenValidFor(30_000))
    const { manager } = tab({ fetchToken })
    manager.start()
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(MIN_REFRESH_DELAY_MS - 1)
    expect(fetchToken).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchToken).toHaveBeenCalledTimes(2)
    manager.stop()
  })

  it('backs off exponentially on 429 (capped at ~60 s) and resets after a success', async () => {
    let calls = 0
    const fetchToken = vi.fn(async () => {
      calls += 1
      if (calls <= 7) throw apiError(429)
      return tokenValidFor(15 * MINUTE)
    })
    const { manager, onToken } = tab({ fetchToken })
    manager.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchToken).toHaveBeenCalledTimes(1)

    // random() = 0.5, so each delay is 3/4 of min(60 s, 2 s * 2^(n-1)).
    const delays = [1_500, 3_000, 6_000, 12_000, 24_000, 45_000, 0.75 * BACKOFF_CAP_MS]
    for (const [index, delay] of delays.entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1)
      expect(fetchToken).toHaveBeenCalledTimes(index + 1)
      await vi.advanceTimersByTimeAsync(1)
      expect(fetchToken).toHaveBeenCalledTimes(index + 2)
    }
    expect(onToken).toHaveBeenCalledTimes(1)
    manager.stop()
  })

  it('retries server errors and network failures the same way', async () => {
    const fetchToken = vi
      .fn<() => Promise<RealtimeToken>>()
      .mockRejectedValueOnce(apiError(500))
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'offline'))
      .mockImplementation(async () => tokenValidFor(15 * MINUTE))
    const { manager, onToken } = tab({ fetchToken })
    manager.start()
    await vi.advanceTimersByTimeAsync(1_500 + 3_000)

    expect(fetchToken).toHaveBeenCalledTimes(3)
    expect(onToken).toHaveBeenCalledTimes(1)
    manager.stop()
  })

  it('stops fetching on 401 (the session is over)', async () => {
    const fetchToken = vi.fn(async (): Promise<RealtimeToken> => {
      throw apiError(401)
    })
    const { manager } = tab({ fetchToken })
    manager.start()
    await vi.advanceTimersByTimeAsync(10 * MINUTE)

    expect(fetchToken).toHaveBeenCalledTimes(1)
    manager.stop()
  })

  it('stop clears timers and ignores a fetch that resolves afterwards', async () => {
    let resolve!: (token: RealtimeToken) => void
    const fetchToken = vi.fn(() => new Promise<RealtimeToken>((r) => (resolve = r)))
    const { manager, onToken } = tab({ fetchToken })
    manager.start()
    manager.stop()
    resolve(tokenValidFor(15 * MINUTE))
    await vi.advanceTimersByTimeAsync(60 * MINUTE)

    expect(onToken).not.toHaveBeenCalled()
    expect(manager.current()).toBeNull()
    expect(fetchToken).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('refreshNow fetches, but not within 30 s of the last fetch', async () => {
    const { manager, fetchToken } = tab()
    manager.start()
    await vi.advanceTimersByTimeAsync(0)

    manager.refreshNow()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchToken).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30_000)
    manager.refreshNow()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchToken).toHaveBeenCalledTimes(2)
    manager.stop()
  })
})

describe('across tabs (Web Locks + BroadcastChannel)', () => {
  let hub: ChannelHub
  let locks: FakeLocks

  beforeEach(() => {
    hub = new ChannelHub()
    locks = new FakeLocks()
  })

  it('the first tab takes the lock, waits briefly for peers, then fetches and shares', async () => {
    const a = tab({ hub, sharedLocks: locks })
    a.manager.start()
    expect(locks.requests).toEqual([tokenLockName(PROFILE)])
    expect([...hub.channels].map((c) => c.name)).toEqual([tokenChannelName(PROFILE)])

    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS - 1)
    expect(a.fetchToken).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(a.fetchToken).toHaveBeenCalledTimes(1)
    a.manager.stop()
  })

  it('a new tab adopts the current token without fetching', async () => {
    const a = tab({ hub, sharedLocks: locks })
    a.manager.start()
    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS)
    const shared = a.manager.current()!

    const b = tab({ hub, sharedLocks: locks })
    b.manager.start()
    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS)

    expect(b.fetchToken).not.toHaveBeenCalled()
    expect(b.onToken).toHaveBeenCalledWith(shared.token)
    expect(b.manager.current()).toEqual(shared)
    a.manager.stop()
    b.manager.stop()
  })

  it('only the leader refreshes; followers adopt each new token', async () => {
    const a = tab({ hub, sharedLocks: locks })
    const b = tab({ hub, sharedLocks: locks })
    const c = tab({ hub, sharedLocks: locks })
    a.manager.start()
    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS)
    b.manager.start()
    c.manager.start()

    // An hour: four 15-minute tokens, fetched once each.
    await vi.advanceTimersByTimeAsync(60 * MINUTE)

    expect(a.fetchToken).toHaveBeenCalledTimes(5)
    expect(b.fetchToken).not.toHaveBeenCalled()
    expect(c.fetchToken).not.toHaveBeenCalled()
    expect(b.manager.current()).toEqual(a.manager.current())
    expect(c.onToken).toHaveBeenCalledTimes(5)
    for (const t of [a, b, c]) t.manager.stop()
  })

  it('when the leader closes, the next tab takes over with the token it holds', async () => {
    const a = tab({ hub, sharedLocks: locks })
    const b = tab({ hub, sharedLocks: locks })
    a.manager.start()
    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS)
    b.manager.start()
    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS)

    a.manager.stop()
    await vi.advanceTimersByTimeAsync(0)
    expect(b.fetchToken).not.toHaveBeenCalled()

    // B refreshes on the leader's schedule: 60 s before expiry.
    await vi.advanceTimersByTimeAsync(14 * MINUTE - INITIAL_WAIT_MS)
    expect(b.fetchToken).toHaveBeenCalledTimes(1)
    b.manager.stop()
  })

  it('a follower fetches itself if the leader never shares a token', async () => {
    // A leader stuck without a token (frozen tab): its fetch never settles.
    const a = tab({ hub, sharedLocks: locks, fetchToken: vi.fn(() => new Promise<RealtimeToken>(() => {})) })
    a.manager.start()
    const b = tab({ hub, sharedLocks: locks })
    b.manager.start()

    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS + FOLLOWER_FIRST_TOKEN_TIMEOUT_MS)
    expect(b.fetchToken).toHaveBeenCalledTimes(1)
    expect(b.onToken).toHaveBeenCalledTimes(1)
    a.manager.stop()
    b.manager.stop()
  })

  it('a follower asks the leader for a forced refresh instead of fetching', async () => {
    const a = tab({ hub, sharedLocks: locks })
    a.manager.start()
    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS)
    const b = tab({ hub, sharedLocks: locks })
    b.manager.start()
    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS + 30_000)

    b.manager.refreshNow()
    await vi.advanceTimersByTimeAsync(0)

    expect(b.fetchToken).not.toHaveBeenCalled()
    expect(a.fetchToken).toHaveBeenCalledTimes(2)
    expect(b.manager.current()).toEqual(a.manager.current())
    a.manager.stop()
    b.manager.stop()
  })

  it('ignores stale or malformed messages from other tabs', async () => {
    const a = tab({ hub, sharedLocks: locks })
    a.manager.start()
    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS)
    const held = a.manager.current()

    const intruder = hub.open(tokenChannelName(PROFILE))
    const fresh = tokenValidFor(30 * MINUTE)
    const message = { type: 'token', profileId: PROFILE, ...fresh }
    intruder.postMessage({ ...message, expiresAt: new Date(Date.now() - 1).toISOString() })
    intruder.postMessage({ ...message, expiresAt: 'later' })
    intruder.postMessage({ ...message, token: '' })
    intruder.postMessage({ ...message, token: 'x'.repeat(9_000) })
    // Another user's message, and the right profile id carrying someone else's token.
    intruder.postMessage({ ...message, profileId: OTHER_PROFILE })
    intruder.postMessage({ ...message, token: tokenValidFor(30 * MINUTE, OTHER_PROFILE).token })
    intruder.postMessage({ type: 'token', ...fresh })
    intruder.postMessage('nonsense')
    await vi.advanceTimersByTimeAsync(0)

    expect(a.manager.current()).toEqual(held)
    expect(a.onToken).toHaveBeenCalledTimes(1)
    intruder.close()
    a.manager.stop()
  })

  it('stop closes the channel, releases the lock, and leaves a queued lock request', async () => {
    const a = tab({ hub, sharedLocks: locks })
    const b = tab({ hub, sharedLocks: locks })
    a.manager.start()
    b.manager.start()
    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS)
    expect(locks.queue).toHaveLength(1)

    b.manager.stop()
    expect(locks.queue).toHaveLength(0)
    a.manager.stop()
    await vi.advanceTimersByTimeAsync(0)
    expect(locks.holder).toBeNull()
    expect(hub.channels.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('tabs of different users never share: separate channels and locks', async () => {
    const a = tab({ hub, sharedLocks: locks })
    a.manager.start()
    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS)
    // Web Locks are per name; the fake isn't, so the other user's lock gets its own manager.
    const otherLocks = new FakeLocks()
    const b = tab({
      hub,
      sharedLocks: otherLocks,
      profileId: OTHER_PROFILE,
      fetchToken: vi.fn(async () => tokenValidFor(15 * MINUTE, OTHER_PROFILE)),
    })
    b.manager.start()
    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS)

    expect(b.fetchToken).toHaveBeenCalledTimes(1)
    expect(tokenSubject(b.manager.current()!.token)).toBe(OTHER_PROFILE)
    expect(tokenSubject(a.manager.current()!.token)).toBe(PROFILE)
    expect(locks.requests).toEqual([tokenLockName(PROFILE)])
    expect(otherLocks.requests).toEqual([tokenLockName(OTHER_PROFILE)])
    a.manager.stop()
    b.manager.stop()
  })

  it("stop with announce signs out the same user's other tabs only", async () => {
    const onSignedOut = vi.fn()
    const otherUser = vi.fn()
    const a = tab({ hub, sharedLocks: locks })
    const b = tab({ hub, sharedLocks: locks, onSignedOut })
    const c = tab({ hub, sharedLocks: new FakeLocks(), profileId: OTHER_PROFILE, onSignedOut: otherUser })
    a.manager.start()
    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS)
    b.manager.start()
    c.manager.start()
    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS)

    a.manager.stop({ announce: true })
    await vi.advanceTimersByTimeAsync(0)

    expect(onSignedOut).toHaveBeenCalledTimes(1)
    expect(b.manager.current()).toBeNull()
    expect(b.manager.isActive()).toBe(false)
    expect(otherUser).not.toHaveBeenCalled()
    b.manager.stop()
    c.manager.stop()
  })

  it('a plain stop (user switch) does not sign other tabs out', async () => {
    const onSignedOut = vi.fn()
    const a = tab({ hub, sharedLocks: locks })
    const b = tab({ hub, sharedLocks: locks, onSignedOut })
    a.manager.start()
    b.manager.start()
    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS)

    a.manager.stop()
    await vi.advanceTimersByTimeAsync(0)

    expect(onSignedOut).not.toHaveBeenCalled()
    b.manager.stop()
  })

  it('after a 401 a tab drops its token and stops answering requests', async () => {
    let calls = 0
    const a = tab({
      hub,
      sharedLocks: locks,
      fetchToken: vi.fn(async () => {
        calls += 1
        if (calls > 1) throw apiError(401)
        return tokenValidFor(15 * MINUTE)
      }),
    })
    a.manager.start()
    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS + 14 * MINUTE)
    expect(a.manager.current()).toBeNull()
    expect(a.manager.isActive()).toBe(false)

    const b = tab({ hub, sharedLocks: locks })
    b.manager.start()
    await vi.advanceTimersByTimeAsync(INITIAL_WAIT_MS)
    expect(b.onToken).not.toHaveBeenCalled()
    a.manager.stop()
    b.manager.stop()
  })
})

describe('token checks', () => {
  it('refuses a fetched token issued to another user, and retries', async () => {
    const fetchToken = vi
      .fn<() => Promise<RealtimeToken>>()
      .mockImplementationOnce(async () => tokenValidFor(15 * MINUTE, OTHER_PROFILE))
      .mockImplementation(async () => tokenValidFor(15 * MINUTE))
    const { manager, onToken } = tab({ fetchToken })
    manager.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(onToken).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1_500)
    expect(onToken).toHaveBeenCalledTimes(1)
    expect(tokenSubject(manager.current()!.token)).toBe(PROFILE)
    manager.stop()
  })

  it('refuses a token that is not a readable JWT', async () => {
    const fetchToken = vi.fn(async () => ({
      token: 'opaque',
      expiresAt: new Date(Date.now() + 15 * MINUTE).toISOString(),
    }))
    const { manager, onToken } = tab({ fetchToken })
    manager.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(onToken).not.toHaveBeenCalled()
    manager.stop()
  })

  it('clamps a far-future expiry to 2 hours, so refreshes still happen', async () => {
    const fetchToken = vi.fn(async () => tokenValidFor(365 * 24 * 60 * MINUTE))
    const { manager } = tab({ fetchToken })
    manager.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(Date.parse(manager.current()!.expiresAt)).toBe(Date.now() + MAX_TOKEN_LIFETIME_MS)
    await vi.advanceTimersByTimeAsync(MAX_TOKEN_LIFETIME_MS - 60_000)
    expect(fetchToken).toHaveBeenCalledTimes(2)
    manager.stop()
  })

  it('tokenSubject reads sub from a base64url payload', () => {
    expect(tokenSubject(fakeRealtimeJwt('abc'))).toBe('abc')
    expect(tokenSubject('a.not-base64!.c')).toBeNull()
    expect(tokenSubject('nodots')).toBeNull()
  })
})
