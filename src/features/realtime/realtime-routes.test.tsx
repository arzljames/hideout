import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { MyRoom } from '@/features/rooms'
import { roomKeys } from '@/features/rooms'
import { getRealtimeAccessToken } from '@/lib/realtime/access-token'
import { getRealtimeStatus } from '@/lib/realtime/connection'
import { tokenChannelName } from '@/lib/realtime/token-manager'
import { failOnConsoleError } from '@/test/console-guard'
import { fakeSupabase, type FakeChannel } from '@/test/fake-supabase'
import { meFixture } from '@/test/fixtures/me'
import { nightOwls, pitLane, raidNight, roomPath } from '@/test/fixtures/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'

failOnConsoleError()

const USER_TOPIC = `user:${meFixture.id}`

async function joined(topic: string): Promise<FakeChannel> {
  await vi.waitFor(() => expect(fakeSupabase.channelsFor(topic)).toHaveLength(1))
  return fakeSupabase.channelsFor(topic)[0]!
}

function roomIds(rooms: MyRoom[] | undefined) {
  return rooms?.map((entry) => entry.room.id)
}

afterEach(() => {
  server.events.removeAllListeners()
})

describe('Realtime in signed-in layouts', () => {
  it('Home starts Realtime and joins only the user topic', async () => {
    await renderRoute('/')
    await joined(USER_TOPIC)

    expect(getRealtimeStatus()).toBe('ready')
    expect(fakeSupabase.channels.map((c) => c.subTopic)).toEqual([USER_TOPIC])
  })

  it('room settings (the _focus layout) joins the user and room topics', async () => {
    await renderRoute(`/rooms/${nightOwls.room.id}/settings`)

    await joined(USER_TOPIC)
    await joined(`room:${nightOwls.room.id}`)
  })

  it('keeps the user topic while moving between rooms, and swaps the room topic', async () => {
    const clicker = userEvent.setup()
    await renderRoute(roomPath(nightOwls, 'general'))
    const user = await joined(USER_TOPIC)
    await joined(`room:${nightOwls.room.id}`)

    const rail = screen.getByRole('navigation', { name: 'Rooms' })
    await clicker.click(await within(rail).findByRole('link', { name: 'Raid Night' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'lobby' })).toBeInTheDocument()

    await joined(`room:${raidNight.room.id}`)
    await vi.waitFor(() =>
      expect(fakeSupabase.channelsFor(`room:${nightOwls.room.id}`)).toHaveLength(0),
    )
    expect(fakeSupabase.channelsFor(USER_TOPIC)).toEqual([user])
    expect(user.removed).toBe(false)
  })
})

describe('useUserEvents', () => {
  it('member:removed for the open room: goes Home, forgets it, and toasts', async () => {
    const { router, queryClient } = await renderRoute(roomPath(nightOwls, 'general'))
    const channel = await joined(USER_TOPIC)

    act(() => channel.emitBroadcast('member:removed', { roomId: nightOwls.room.id }))

    expect(await screen.findByText("You're no longer in Night Owls.")).toBeInTheDocument()
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(roomIds(queryClient.getQueryData(roomKeys.list))).not.toContain(nightOwls.room.id)
  })

  it('member:removed with banned for another room: stays put, forgets it, and toasts', async () => {
    const { router, queryClient } = await renderRoute(roomPath(nightOwls, 'general'))
    const channel = await joined(USER_TOPIC)

    act(() => channel.emitBroadcast('member:removed', { roomId: pitLane.room.id, banned: true }))

    expect(await screen.findByText('You were banned from Pit Lane.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'general'))
    expect(roomIds(queryClient.getQueryData(roomKeys.list))).not.toContain(pitLane.room.id)
  })

  it('member:removed on room settings goes Home too', async () => {
    const { router } = await renderRoute(`${roomPath(nightOwls)}/settings`)
    const channel = await joined(USER_TOPIC)

    act(() => channel.emitBroadcast('member:removed', { roomId: nightOwls.room.id }))

    expect(await screen.findByText("You're no longer in Night Owls.")).toBeInTheDocument()
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('toasts once when the same room goes away on both topics (and again on a repeat)', async () => {
    const { router } = await renderRoute(roomPath(nightOwls, 'general'))
    const userChannel = await joined(USER_TOPIC)
    const roomChannel = await joined(`room:${nightOwls.room.id}`)

    // Both signals navigate asynchronously: keep them inside act until Home has settled.
    await act(async () => {
      roomChannel.emitBroadcast('room:deleted', { id: nightOwls.room.id })
      userChannel.emitBroadcast('member:removed', { roomId: nightOwls.room.id })
      roomChannel.emitBroadcast('room:deleted', { id: nightOwls.room.id })
      await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'))
    })
    expect(await screen.findByText('Night Owls was deleted.')).toBeInTheDocument()
    // A late duplicate after the room is forgotten doesn't toast either.
    act(() => userChannel.emitBroadcast('member:removed', { roomId: nightOwls.room.id }))
    await act(async () => {})
    expect(screen.getAllByText(/Night Owls/, { selector: '[data-sonner-toast] *' })).toHaveLength(1)
  })

  it('ignores invalid payloads and events it does not handle', async () => {
    const { queryClient } = await renderRoute('/')
    const channel = await joined(USER_TOPIC)

    act(() => {
      channel.emitBroadcast('member:removed', { roomId: 'nope' })
      channel.emitBroadcast('member:removed', { banned: true })
      channel.emitBroadcast('invite:revoked', { inviteId: nightOwls.room.id })
    })
    await act(async () => {})

    expect(queryClient.getQueryData<MyRoom[]>(roomKeys.list)).toHaveLength(4)
  })

  it('session:expired runs the sign-out teardown: /sign-in and Realtime stopped', async () => {
    const { router } = await renderRoute(roomPath(nightOwls, 'general'))
    const channel = await joined(USER_TOPIC)

    // The teardown navigates asynchronously: keep it inside act.
    await act(async () => {
      channel.emitBroadcast('session:expired', {})
      await vi.waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
    })
    expect(screen.getByRole('link', { name: 'Sign in with Steam' })).toBeInTheDocument()
    expect(getRealtimeStatus()).toBe('idle')
    expect(getRealtimeAccessToken()).toBeNull()
    expect(fakeSupabase.removeAllChannels).toHaveBeenCalledTimes(1)
    expect(fakeSupabase.realtime.disconnect).toHaveBeenCalledTimes(1)
    expect(fakeSupabase.channels).toEqual([])
  })

  it('refetches the room list after rejoining the user topic', async () => {
    await renderRoute('/')
    const channel = await joined(USER_TOPIC)
    let listRequests = 0
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/rooms') listRequests += 1
    })

    act(() => {
      channel.emitStatus('SUBSCRIBED')
      channel.emitStatus('TIMED_OUT')
      channel.emitStatus('SUBSCRIBED')
    })

    await vi.waitFor(() => expect(listRequests).toBe(1))
  })

  it("another tab's sign-out ends the session here too: /sign-in and Realtime stopped", async () => {
    const { router } = await renderRoute(roomPath(nightOwls, 'general'))
    await joined(USER_TOPIC)
    const otherTab = new BroadcastChannel(tokenChannelName(meFixture.id))

    await act(async () => {
      otherTab.postMessage({ type: 'signout', profileId: meFixture.id })
      await vi.waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
    })

    expect(getRealtimeStatus()).toBe('idle')
    expect(fakeSupabase.channels).toEqual([])
    otherTab.close()
  })
})
