import { http, HttpResponse } from 'msw'
import { api } from '@/lib/api/client'
import { getRealtimeAccessToken } from '@/lib/realtime/access-token'
import { getRealtimeStatus, startRealtime } from '@/lib/realtime/connection'
import { tokenChannelName } from '@/lib/realtime/token-manager'
import { meFixture } from '@/test/fixtures/me'
import { server } from '@/test/msw/server'
import { createTestQueryClient } from '@/test/render'
import { meQueryOptions } from './api'
import { registerSessionExpiry } from './session'

function publicPageRouter() {
  return {
    state: { matches: [{ routeId: '/sign-in' }] },
    navigate: vi.fn(async () => {}),
    invalidate: vi.fn(async () => {}),
  }
}

async function realtimeReady() {
  startRealtime(meFixture.id)
  await vi.waitFor(() => expect(getRealtimeStatus()).toBe('ready'))
}

describe('registerSessionExpiry on a public page', () => {
  it('a 401 stops Realtime, marks the user signed out, and re-runs the guards', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(meQueryOptions.queryKey, meFixture)
    const router = publicPageRouter()
    registerSessionExpiry(queryClient, router as unknown as Parameters<typeof registerSessionExpiry>[1])
    await realtimeReady()
    server.use(
      http.get('*/api/rooms', () =>
        HttpResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in.' } }, { status: 401 }),
      ),
    )

    await api.GET('/api/rooms', { params: { query: {} } })

    expect(getRealtimeStatus()).toBe('idle')
    expect(getRealtimeAccessToken()).toBeNull()
    expect(queryClient.getQueryData(meQueryOptions.queryKey)).toBeNull()
    expect(router.invalidate).toHaveBeenCalled()
    expect(router.navigate).not.toHaveBeenCalled()
  })

  it("another tab's sign-out does the same", async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(meQueryOptions.queryKey, meFixture)
    const router = publicPageRouter()
    registerSessionExpiry(queryClient, router as unknown as Parameters<typeof registerSessionExpiry>[1])
    await realtimeReady()

    const otherTab = new BroadcastChannel(tokenChannelName(meFixture.id))
    otherTab.postMessage({ type: 'signout', profileId: meFixture.id })

    await vi.waitFor(() => expect(router.invalidate).toHaveBeenCalled())
    expect(getRealtimeStatus()).toBe('idle')
    expect(queryClient.getQueryData(meQueryOptions.queryKey)).toBeNull()
    otherTab.close()
  })
})
