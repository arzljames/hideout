import { testRealtimeToken } from '@/test/fixtures/realtime-token'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { vi } from 'vitest'
import { getRealtimeStatus } from '@/lib/realtime/connection'
import { STUCK_AFTER_MS } from '@/lib/realtime/topics'
import { failOnConsoleError } from '@/test/console-guard'
import { fakeSupabase, type FakeChannel } from '@/test/fake-supabase'
import { meFixture } from '@/test/fixtures/me'
import { nightOwls, pitLane, roomPath } from '@/test/fixtures/rooms'
import { roomNotFound } from '@/test/msw/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'
import { roomMutationKeys } from '../api'
import { roomKeys } from '../room-cache'
import type { MyRoom, RoomDetail } from '../types'

failOnConsoleError()

const ROOM_ID = nightOwls.room.id
const ROOM_TOPIC = `room:${ROOM_ID}`
const USER_TOPIC = `user:${meFixture.id}`

async function joined(topic: string): Promise<FakeChannel> {
  await vi.waitFor(() => expect(fakeSupabase.channelsFor(topic)).toHaveLength(1))
  return fakeSupabase.channelsFor(topic)[0]!
}

async function openRoom(options?: { strict?: boolean }) {
  const view = await renderRoute(roomPath(nightOwls, 'general'), options)
  const channel = await joined(ROOM_TOPIC)
  return { ...view, channel }
}

function roomDetailRequests() {
  const count = { value: 0 }
  server.events.on('request:start', ({ request }) => {
    if (new URL(request.url).pathname === `/api/rooms/${ROOM_ID}`) count.value += 1
  })
  return count
}

afterEach(() => {
  server.events.removeAllListeners()
  vi.useRealTimers()
})

describe('useRoomEvents on the room page', () => {
  it('joins the room and user topics as private channels, once each (StrictMode)', async () => {
    let tokenRequests = 0
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/auth/realtime-token') tokenRequests += 1
    })

    const { channel } = await openRoom({ strict: true })
    await joined(USER_TOPIC)

    expect(channel.params).toEqual({ config: { private: true } })
    expect(fakeSupabase.created.filter((c) => c.subTopic === ROOM_TOPIC)).toHaveLength(1)
    expect(fakeSupabase.realtime.setAuth).toHaveBeenCalledWith(testRealtimeToken)
    expect(tokenRequests).toBe(1)
  })

  it('room:updated renames the room everywhere it is cached', async () => {
    const { channel, queryClient } = await openRoom()
    const room = { ...nightOwls.room, name: 'Early Birds', icon: { kind: 'emoji' as const, emoji: '🐦' } }

    act(() => channel.emitBroadcast('room:updated', { room }))

    expect(queryClient.getQueryData<RoomDetail>(roomKeys.detail(ROOM_ID))?.room).toEqual(room)
    expect(
      queryClient.getQueryData<MyRoom[]>(roomKeys.list)?.find((e) => e.room.id === ROOM_ID)?.room,
    ).toEqual(room)
    expect((await screen.findAllByText('Early Birds')).length).toBeGreaterThan(0)
  })

  it('ignores invalid payloads and events for another room', async () => {
    const { channel, queryClient } = await openRoom()
    const before = queryClient.getQueryData<RoomDetail>(roomKeys.detail(ROOM_ID))

    act(() => {
      channel.emitBroadcast('room:updated', { room: { ...nightOwls.room, name: 42 } })
      channel.emitBroadcast('room:updated', { room: { ...pitLane.room, name: 'Elsewhere' } })
      channel.emitBroadcast('room:deleted', { id: 'not-a-uuid' })
      channel.emitBroadcast('room:deleted', { id: pitLane.room.id })
    })

    expect(queryClient.getQueryData<RoomDetail>(roomKeys.detail(ROOM_ID))).toBe(before)
    expect(queryClient.getQueryData<MyRoom[]>(roomKeys.list)).toHaveLength(4)
  })

  it('room:deleted goes Home, forgets the room, and toasts', async () => {
    const { channel, router, queryClient } = await openRoom()

    act(() => channel.emitBroadcast('room:deleted', { id: ROOM_ID }))

    expect(await screen.findByText('Night Owls was deleted.')).toBeInTheDocument()
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(queryClient.getQueryData(roomKeys.detail(ROOM_ID))).toBeUndefined()
    expect(
      queryClient.getQueryData<MyRoom[]>(roomKeys.list)?.some((e) => e.room.id === ROOM_ID),
    ).toBe(false)
    // Leaving the room page leaves its topic.
    await vi.waitFor(() => expect(fakeSupabase.channelsFor(ROOM_TOPIC)).toHaveLength(0))
  })

  it("room:deleted is left to this tab's own in-flight delete", async () => {
    const { channel, router, queryClient } = await openRoom()
    void queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationKey: roomMutationKeys.delete(ROOM_ID),
        mutationFn: () => new Promise<void>(() => {}),
      })
      .execute(undefined)

    act(() => channel.emitBroadcast('room:deleted', { id: ROOM_ID }))
    await act(async () => {})

    expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'general'))
    expect(screen.queryByText('Night Owls was deleted.')).not.toBeInTheDocument()
  })

  it('deleting from settings while room:deleted arrives mid-request: one toast, Home', async () => {
    let respond!: () => void
    server.use(
      http.delete(`*/api/rooms/${ROOM_ID}`, async () => {
        await new Promise<void>((resolve) => {
          respond = resolve
        })
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    const { router } = await renderRoute(`${roomPath(nightOwls)}/settings`)
    const channel = await joined(ROOM_TOPIC)
    await user.click(screen.getByRole('button', { name: 'Delete room' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Night Owls?' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Type Night Owls to confirm' }), 'Night Owls{Enter}')
    await vi.waitFor(() => expect(respond).toBeDefined())

    // The server broadcasts the delete before this tab's request has answered.
    act(() => channel.emitBroadcast('room:deleted', { id: ROOM_ID }))
    await act(async () => {})
    expect(router.state.location.pathname).toBe(`${roomPath(nightOwls)}/settings`)

    await act(async () => {
      respond()
      await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'))
    })
    expect(await screen.findByText('Deleted Night Owls')).toBeInTheDocument()
    expect(screen.queryByText('Night Owls was deleted.')).not.toBeInTheDocument()
  })

  it('refetches the room after rejoining (broadcasts sent meanwhile are lost)', async () => {
    const { channel } = await openRoom()
    const requests = roomDetailRequests()

    act(() => channel.emitStatus('SUBSCRIBED'))
    expect(requests.value).toBe(0)

    act(() => {
      channel.emitStatus('CHANNEL_ERROR', new Error('socket closed'))
      channel.emitStatus('SUBSCRIBED')
    })
    await vi.waitFor(() => expect(requests.value).toBe(1))
  })

  it('stuck but the room exists: shows "Live updates paused" until it subscribes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { channel } = await openRoom()

    await act(() => vi.advanceTimersByTimeAsync(STUCK_AFTER_MS))

    const title = await screen.findByText('Live updates paused, retrying…')
    // A polite status, not an alert: the room stays usable.
    expect(title.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite')

    act(() => channel.emitStatus('SUBSCRIBED'))
    await vi.waitFor(() =>
      expect(screen.queryByText('Live updates paused, retrying…')).not.toBeInTheDocument(),
    )
  })

  it('stuck and the room 404s: leaves, forgets the room, and removes the channel', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { channel, router, queryClient } = await openRoom()
    server.use(http.get(`*/api/rooms/${ROOM_ID}`, () => roomNotFound()))

    for (let i = 0; i < 5; i += 1) act(() => channel.emitStatus('CHANNEL_ERROR'))

    expect(await screen.findByText("You're no longer in Night Owls.")).toBeInTheDocument()
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(queryClient.getQueryData(roomKeys.detail(ROOM_ID))).toBeUndefined()
    await vi.waitFor(() => expect(channel.removed).toBe(true))
    expect(screen.queryByText('Live updates paused, retrying…')).not.toBeInTheDocument()
  })

  it('no token for 30 s (e.g. rate limited) also shows the paused banner', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    server.use(
      http.get('*/api/auth/realtime-token', () =>
        HttpResponse.json({ error: { code: 'RATE_LIMITED', message: 'Slow down.' } }, { status: 429 }),
      ),
    )
    await renderRoute(roomPath(nightOwls, 'general'))
    expect(getRealtimeStatus()).toBe('connecting')

    await act(() => vi.advanceTimersByTimeAsync(STUCK_AFTER_MS))

    expect(screen.getByText('Live updates paused, retrying…')).toBeInTheDocument()
    expect(fakeSupabase.channelsFor(ROOM_TOPIC)).toHaveLength(0)
  })
})
