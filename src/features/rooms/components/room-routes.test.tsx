import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { vi } from 'vitest'
import { failOnConsoleError } from '@/test/console-guard'
import {
  channelOf,
  missingRoomId,
  nightOwls,
  pitLane,
  raidNight,
  rockAndStone,
  roomPath,
} from '@/test/fixtures/rooms'
import { roomNotFound, roomsListHandler } from '@/test/msw/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'
import { fakeSupabase } from '@/test/fake-supabase'
import { meFixture } from '@/test/fixtures/me'
import { roomKeys } from '../room-cache'
import type { MyRoom } from '../types'

failOnConsoleError()

// Route tests for /rooms/$roomId, /rooms/$roomId/ and /rooms/$roomId/$channelId, plus the
// rail and nav panel, which depend on the matched route. (Kept out of src/routes so the router
// plugin doesn't treat the test as a route file.)

describe('room routes', () => {
  it('redirects a room to its default text channel, #general', async () => {
    const { router } = await renderRoute(roomPath(nightOwls))

    expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'general'))
    expect(screen.getByRole('heading', { level: 1, name: 'general' })).toBeInTheDocument()
  })

  it.each([
    ['a malformed room id', '/rooms/nope/general'],
    ['a room the API 404s', `/rooms/${missingRoomId}/general`],
  ])('shows "This room isn\'t available" with a Home link for %s', async (_label, path) => {
    const { router } = await renderRoute(path)

    expect(
      screen.getByRole('heading', { level: 2, name: "This room isn't available" }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/')
    // No channel panel for a room you can't see.
    expect(screen.queryByRole('navigation', { name: 'Channels' })).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe(path)
  })

  it.each([
    ['a malformed room id', '/rooms/nope'],
    ['a room the API 404s', `/rooms/${missingRoomId}`],
  ])('shows the same not-available screen for %s without a channel', async (_label, path) => {
    await renderRoute(path)

    expect(
      screen.getByRole('heading', { level: 2, name: "This room isn't available" }),
    ).toBeInTheDocument()
  })

  it("doesn't ask the API about a malformed room id", async () => {
    const requested: string[] = []
    server.events.on('request:start', ({ request }) => {
      requested.push(new URL(request.url).pathname)
    })

    await renderRoute('/rooms/nope/general')

    expect(requested.filter((path) => path.startsWith('/api/rooms/'))).toEqual([])
    server.events.removeAllListeners()
  })

  it('drops a room from the rail when opening it 404s (you were removed, or it was deleted)', async () => {
    const { router } = await renderRoute('/')
    const rail = screen.getByRole('navigation', { name: 'Rooms' })
    expect(await within(rail).findByRole('link', { name: 'Night Owls' })).toBeInTheDocument()
    server.use(http.get(`*/api/rooms/${nightOwls.room.id}`, () => roomNotFound()))

    act(() => {
      void router.navigate({ to: roomPath(nightOwls, 'general') })
    })

    expect(
      await screen.findByRole('heading', { level: 2, name: "This room isn't available" }),
    ).toBeInTheDocument()
    expect(within(rail).queryByRole('link', { name: 'Night Owls' })).not.toBeInTheDocument()
    expect(within(rail).getByRole('link', { name: 'Raid Night' })).toBeInTheDocument()
  })

  it('goes Home from the not-available screen', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute('/rooms/nope/general')

    await user.click(screen.getByRole('link', { name: 'Go to Home' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('shows "This channel doesn\'t exist" inside the room layout for an unknown channel', async () => {
    await renderRoute(`${roomPath(nightOwls)}/nope`)

    expect(
      screen.getByRole('heading', { level: 2, name: "This channel doesn't exist" }),
    ).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Channels' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Night Owls' })).toHaveAttribute(
      'href',
      roomPath(nightOwls, 'general'),
    )
  })

  it.each([
    ['/', 'Home'],
    [roomPath(nightOwls, 'general'), 'general'],
    [roomPath(nightOwls, 'clips'), 'clips'],
    [roomPath(nightOwls, 'voice'), 'voice'],
    [roomPath(nightOwls, 'late night'), 'late night'],
    [roomPath(raidNight, 'lobby'), 'lobby'],
    [`${roomPath(nightOwls)}/nope`, 'Channel not found'],
    ['/rooms/nope/general', 'Room not available'],
  ])('%s has exactly one main and one h1, "%s"', async (path, title) => {
    await renderRoute(path)

    expect(screen.getAllByRole('main')).toHaveLength(1)
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent(title)
    expect(screen.getByRole('main')).toContainElement(headings[0] ?? null)
  })
})

describe('room rail', () => {
  it('names the Home link with the pending invite count', async () => {
    await renderRoute(roomPath(nightOwls, 'general'))

    const rail = screen.getByRole('navigation', { name: 'Rooms' })
    const home = within(rail).getByRole('link', { name: 'Home, 3 pending invites' })
    expect(home).toHaveAttribute('href', '/')
    expect(home).not.toHaveAttribute('aria-current')
  })

  it('links each room tile to its room and marks the open room as current', async () => {
    await renderRoute(roomPath(nightOwls, 'general'))

    const rail = screen.getByRole('navigation', { name: 'Rooms' })
    const rooms = [nightOwls, raidNight, rockAndStone, pitLane]
    for (const detail of rooms) {
      expect(await within(rail).findByRole('link', { name: detail.room.name })).toHaveAttribute(
        'href',
        roomPath(detail),
      )
    }
    expect(within(rail).getByRole('link', { name: 'Night Owls' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    for (const name of ['Raid Night', 'Rock and Stone', 'Pit Lane']) {
      expect(within(rail).getByRole('link', { name })).not.toHaveAttribute('aria-current')
    }
  })

  it('marks Home as current on / and no room tile', async () => {
    await renderRoute('/')

    const rail = screen.getByRole('navigation', { name: 'Rooms' })
    expect(within(rail).getByRole('link', { name: 'Home, 3 pending invites' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(await within(rail).findByRole('link', { name: 'Night Owls' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('shows placeholder tiles while the rooms load', async () => {
    server.use(http.get('*/api/rooms', () => new Promise<never>(() => {})))

    await renderRoute('/invites')

    const rail = screen.getByRole('navigation', { name: 'Rooms' })
    expect(within(rail).getByRole('status')).toHaveTextContent('Loading rooms')
  })

  it('offers a retry when the rooms fail to load, and shows them once it works', async () => {
    const user = userEvent.setup()
    let fail = true
    server.use(
      http.get('*/api/rooms', () =>
        fail
          ? HttpResponse.json({ error: { code: 'INTERNAL', message: 'Broke.' } }, { status: 500 })
          : HttpResponse.json({ data: [], nextCursor: null }),
      ),
    )
    await renderRoute(roomPath(nightOwls, 'general'))
    const rail = screen.getByRole('navigation', { name: 'Rooms' })

    const retry = await within(rail).findByRole(
      'button',
      { name: "Couldn't load rooms. Retry" },
      // One automatic retry for a 500 before the error shows.
      { timeout: 3000 },
    )
    // The room itself still works.
    expect(screen.getByRole('heading', { level: 1, name: 'general' })).toBeInTheDocument()

    fail = false
    await user.click(retry)

    await vi.waitFor(() =>
      expect(
        within(rail).queryByRole('button', { name: "Couldn't load rooms. Retry" }),
      ).not.toBeInTheDocument(),
    )
  })

  it('follows nextCursor until every page of rooms is loaded', async () => {
    const all = [nightOwls, raidNight, rockAndStone, pitLane]
    const requested: { limit: string | null; cursor: string | null }[] = []
    server.use(
      http.get('*/api/rooms', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        requested.push({ limit: new URL(request.url).searchParams.get('limit'), cursor })
        const start = cursor ? Number(cursor) : 0
        const page = all.slice(start, start + 2)
        const next = start + 2 < all.length ? String(start + 2) : null
        return HttpResponse.json({
          data: page.map((detail) => ({
            room: detail.room,
            myRole: detail.myRole,
            joinedAt: '2026-03-15T12:00:00.000Z',
          })),
          nextCursor: next,
        })
      }),
    )

    await renderRoute('/invites')

    const rail = screen.getByRole('navigation', { name: 'Rooms' })
    expect(await within(rail).findByRole('link', { name: 'Pit Lane' })).toBeInTheDocument()
    expect(within(rail).getAllByRole('link', { name: /Night Owls|Raid Night|Rock and Stone|Pit Lane/ })).toHaveLength(4)
    // The largest page the API serves, and each page's cursor passed along.
    expect(requested).toEqual([
      { limit: '100', cursor: null },
      { limit: '100', cursor: '2' },
    ])
  })

  it('shows no room tiles, but still offers Create a room, when you have no rooms', async () => {
    server.use(roomsListHandler([]))

    await renderRoute('/invites')

    const rail = screen.getByRole('navigation', { name: 'Rooms' })
    await vi.waitFor(() => expect(within(rail).queryByRole('status')).not.toBeInTheDocument())
    expect(within(rail).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/'])
    expect(within(rail).getByRole('button', { name: 'Create a room' })).toBeInTheDocument()
  })

  it('opens another room at its default channel from its tile', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute(roomPath(nightOwls, 'general'))

    const rail = screen.getByRole('navigation', { name: 'Rooms' })
    await user.click(await within(rail).findByRole('link', { name: 'Raid Night' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'lobby' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(roomPath(raidNight, 'lobby'))
    expect(within(rail).getByRole('link', { name: 'Raid Night' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const channels = screen.getByRole('navigation', { name: 'Channels' })
    expect(within(channels).getByRole('link', { name: 'lobby' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(channelOf(raidNight, 'lobby').id).toBe(raidNight.defaultChannelId)
  })
})

describe('nav panel', () => {
  it('shows the Home sections on /', async () => {
    await renderRoute('/')

    expect(screen.getByRole('navigation', { name: 'Home sections' })).toBeInTheDocument()
    // Invites is a link to the inbox now, named with its pending count.
    expect(screen.getByRole('link', { name: 'Invites 3 pending' })).toHaveAttribute('href', '/invites')
    expect(screen.queryByRole('navigation', { name: 'Channels' })).not.toBeInTheDocument()
  })

  it('shows the channel panel inside a room', async () => {
    await renderRoute(roomPath(nightOwls, 'general'))

    expect(screen.getByRole('navigation', { name: 'Channels' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Home sections' })).not.toBeInTheDocument()
  })
})

describe('rooms list refetch failures', () => {
  it('keeps the rail tiles when a background refetch fails', async () => {
    const { queryClient } = await renderRoute(roomPath(nightOwls, 'general'))
    const rail = screen.getByRole('navigation', { name: 'Rooms' })
    await within(rail).findByRole('link', { name: 'Pit Lane' })

    // A 422 isn't retried, so the refetch fails straight away.
    server.use(
      http.get('*/api/rooms', () =>
        HttpResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'Bad.' } }, { status: 422 }),
      ),
    )
    await act(() => queryClient.refetchQueries({ queryKey: roomKeys.list }))

    expect(queryClient.getQueryState(roomKeys.list)?.status).toBe('error')
    expect(within(rail).getByRole('link', { name: 'Pit Lane' })).toBeInTheDocument()
    expect(
      within(rail).queryByRole('button', { name: "Couldn't load rooms. Retry" }),
    ).not.toBeInTheDocument()
  })
})

describe('room ids in the URL', () => {
  it('replaces an uppercase room id with the lowercase one', async () => {
    const upper = `/rooms/${nightOwls.room.id.toUpperCase()}/${nightOwls.defaultChannelId}`

    const { router } = await renderRoute(upper)

    expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'general'))
    expect(screen.getByRole('heading', { level: 1, name: 'general' })).toBeInTheDocument()
  })

  it('leaves a room opened via an uppercase URL on member:removed, and forgets it', async () => {
    const upper = `/rooms/${nightOwls.room.id.toUpperCase()}/${nightOwls.defaultChannelId}`
    const { router, queryClient } = await renderRoute(upper)
    const topic = `user:${meFixture.id}`
    await vi.waitFor(() => expect(fakeSupabase.channelsFor(topic)).toHaveLength(1))

    // Removed on the server: the room now 404s for us.
    server.use(http.get('*/api/rooms/:roomId', () => roomNotFound()))

    act(() =>
      fakeSupabase.channelsFor(topic)[0]!.emitBroadcast('member:removed', {
        roomId: nightOwls.room.id,
      }),
    )

    expect(await screen.findByText("You're no longer in Night Owls.")).toBeInTheDocument()
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(queryClient.getQueryData(roomKeys.detail(nightOwls.room.id))).toBeUndefined()
    expect(
      queryClient.getQueryData<MyRoom[]>(roomKeys.list)?.map((entry) => entry.room.id),
    ).not.toContain(nightOwls.room.id)
  })
})
