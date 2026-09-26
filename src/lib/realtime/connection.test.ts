import { http, HttpResponse } from 'msw'
import { setUnauthenticatedHandler } from '@/lib/api/client'
import { fakeSupabase } from '@/test/fake-supabase'
import { meFixture } from '@/test/fixtures/me'
import { fakeRealtimeJwt, testRealtimeToken } from '@/test/fixtures/realtime-token'
import { server } from '@/test/msw/server'
import { getRealtimeAccessToken, setRealtimeAccessToken } from './access-token'
import { tokenChannelName } from './token-manager'
import {
  getRealtimeStatus,
  setRealtimeSignedOutHandler,
  startRealtime,
  stopRealtime,
  subscribeRealtimeStatus,
} from './connection'

function countTokenRequests() {
  const count = { value: 0 }
  server.events.on('request:start', ({ request }) => {
    if (new URL(request.url).pathname === '/api/auth/realtime-token') count.value += 1
  })
  return count
}

afterEach(() => {
  server.events.removeAllListeners()
})

describe('startRealtime', () => {
  it('fetches a token, calls setAuth with it, and becomes ready', async () => {
    const statuses: string[] = []
    const unsubscribe = subscribeRealtimeStatus(() => statuses.push(getRealtimeStatus()))

    startRealtime(meFixture.id)
    expect(getRealtimeStatus()).toBe('connecting')
    await vi.waitFor(() => expect(getRealtimeStatus()).toBe('ready'))

    expect(fakeSupabase.realtime.setAuth).toHaveBeenCalledWith(testRealtimeToken)
    expect(getRealtimeAccessToken()).toBe(testRealtimeToken)
    expect(statuses).toEqual(['connecting', 'ready'])
    unsubscribe()
  })

  it('is idempotent (StrictMode double mount, switching layouts): one token request', async () => {
    const requests = countTokenRequests()

    startRealtime(meFixture.id)
    startRealtime(meFixture.id)
    await vi.waitFor(() => expect(getRealtimeStatus()).toBe('ready'))
    startRealtime(meFixture.id)

    expect(requests.value).toBe(1)
  })

  it('on 401 stays connecting, hands off to the session-expiry handler, and does not retry', async () => {
    const onUnauthenticated = vi.fn()
    setUnauthenticatedHandler(onUnauthenticated)
    const requests = countTokenRequests()
    server.use(
      http.get('*/api/auth/realtime-token', () =>
        HttpResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in.' } }, { status: 401 }),
      ),
    )

    startRealtime(meFixture.id)
    await vi.waitFor(() => expect(onUnauthenticated).toHaveBeenCalledTimes(1))

    expect(getRealtimeStatus()).toBe('connecting')
    expect(fakeSupabase.realtime.setAuth).not.toHaveBeenCalled()
    expect(requests.value).toBe(1)
  })
})

describe('per-user sessions', () => {
  const OTHER_ID = 'e0000000-0000-4000-8000-000000000042'

  it('refuses a token issued to someone else', async () => {
    const onUnauthenticated = vi.fn()
    setUnauthenticatedHandler(onUnauthenticated)
    server.use(
      http.get('*/api/auth/realtime-token', () =>
        HttpResponse.json({
          token: fakeRealtimeJwt(OTHER_ID),
          expiresAt: new Date(Date.now() + 900_000).toISOString(),
        }),
      ),
    )

    startRealtime(meFixture.id)
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(getRealtimeStatus()).toBe('connecting')
    expect(getRealtimeAccessToken()).toBeNull()
    expect(fakeSupabase.realtime.setAuth).not.toHaveBeenCalled()
  })

  it('signing in as a different user starts over with a fresh token', async () => {
    const requests = countTokenRequests()
    startRealtime(meFixture.id)
    await vi.waitFor(() => expect(getRealtimeStatus()).toBe('ready'))
    fakeSupabase.channel('user:' + meFixture.id)

    const otherToken = fakeRealtimeJwt(OTHER_ID)
    server.use(
      http.get('*/api/auth/realtime-token', () =>
        HttpResponse.json({ token: otherToken, expiresAt: new Date(Date.now() + 900_000).toISOString() }),
      ),
    )
    startRealtime(OTHER_ID)

    // The old user's channels and token are gone before the new token arrives.
    expect(fakeSupabase.removeAllChannels).toHaveBeenCalledTimes(1)
    expect(getRealtimeAccessToken()).toBeNull()
    await vi.waitFor(() => expect(getRealtimeAccessToken()).toBe(otherToken))
    expect(requests.value).toBe(2)
  })

  it('starts over after a 401 (e.g. signed out, then signed back in)', async () => {
    setUnauthenticatedHandler(() => {})
    const requests = countTokenRequests()
    server.use(
      http.get(
        '*/api/auth/realtime-token',
        () => HttpResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in.' } }, { status: 401 }),
        { once: true },
      ),
    )
    startRealtime(meFixture.id)
    await vi.waitFor(() => expect(requests.value).toBe(1))
    await new Promise((resolve) => setTimeout(resolve, 20))

    startRealtime(meFixture.id)
    await vi.waitFor(() => expect(getRealtimeStatus()).toBe('ready'))
    expect(requests.value).toBe(2)
  })

  it("stopRealtime tells this user's other tabs to sign out", async () => {
    startRealtime(meFixture.id)
    await vi.waitFor(() => expect(getRealtimeStatus()).toBe('ready'))
    const otherTab = new BroadcastChannel(tokenChannelName(meFixture.id))
    const received: unknown[] = []
    otherTab.onmessage = (event) => received.push(event.data)

    stopRealtime()

    await vi.waitFor(() =>
      expect(received).toContainEqual({ type: 'signout', profileId: meFixture.id }),
    )
    otherTab.close()
  })

  it("another tab's sign-out stops Realtime here and runs the signed-out handler", async () => {
    const onSignedOut = vi.fn()
    setRealtimeSignedOutHandler(onSignedOut)
    startRealtime(meFixture.id)
    await vi.waitFor(() => expect(getRealtimeStatus()).toBe('ready'))

    const otherTab = new BroadcastChannel(tokenChannelName(meFixture.id))
    // Another user's sign-out is ignored.
    otherTab.postMessage({ type: 'signout', profileId: 'e0000000-0000-4000-8000-000000000042' })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(onSignedOut).not.toHaveBeenCalled()

    otherTab.postMessage({ type: 'signout', profileId: meFixture.id })
    await vi.waitFor(() => expect(onSignedOut).toHaveBeenCalledTimes(1))
    expect(getRealtimeStatus()).toBe('idle')
    expect(getRealtimeAccessToken()).toBeNull()
    expect(fakeSupabase.removeAllChannels).toHaveBeenCalledTimes(1)
    otherTab.close()
  })
})

describe('stopRealtime', () => {
  it('removes every channel, disconnects, forgets the token, and goes idle', async () => {
    startRealtime(meFixture.id)
    await vi.waitFor(() => expect(getRealtimeStatus()).toBe('ready'))

    stopRealtime()

    expect(fakeSupabase.removeAllChannels).toHaveBeenCalledTimes(1)
    expect(fakeSupabase.realtime.disconnect).toHaveBeenCalledTimes(1)
    expect(getRealtimeAccessToken()).toBeNull()
    expect(getRealtimeStatus()).toBe('idle')
  })

  it('is idempotent and a no-op before start', () => {
    stopRealtime()
    stopRealtime()
    expect(fakeSupabase.removeAllChannels).not.toHaveBeenCalled()
  })

  it('ignores a token that arrives after stop, and can start again', async () => {
    let release!: () => void
    server.use(
      http.get('*/api/auth/realtime-token', async () => {
        await new Promise<void>((resolve) => (release = resolve))
        return HttpResponse.json({ token: 'late', expiresAt: new Date(Date.now() + 900_000).toISOString() })
      }),
    )
    startRealtime(meFixture.id)
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    stopRealtime()
    release()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(getRealtimeAccessToken()).toBeNull()
    expect(getRealtimeStatus()).toBe('idle')
    expect(fakeSupabase.realtime.setAuth).not.toHaveBeenCalled()

    server.resetHandlers()
    startRealtime(meFixture.id)
    await vi.waitFor(() => expect(getRealtimeStatus()).toBe('ready'))
    expect(getRealtimeAccessToken()).toBe(testRealtimeToken)
  })
})

describe('the real supabase-js client', () => {
  afterEach(() => setRealtimeAccessToken(null))

  it("keeps our token on heartbeats instead of falling back to the anon key", async () => {
    const { supabase } = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase')
    setRealtimeAccessToken('hideout-jwt')

    // What realtime-js does on connect and every heartbeat: re-run the token callback.
    await supabase.realtime.setAuth()

    expect(supabase.realtime.accessTokenValue).toBe('hideout-jwt')
    expect(supabase.realtime.accessTokenValue).not.toBe('test-anon-key')
  })
})
