import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { RoomDetail } from '@/features/rooms'
import { failOnConsoleError } from '@/test/console-guard'
import { nightOwls, pitLane, raidNight, rockAndStone, roomPath } from '@/test/fixtures/rooms'
import { roomsListHandler } from '@/test/msw/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'
import { act } from '@testing-library/react'
import { roomKeys } from '@/features/rooms'

failOnConsoleError()

async function renderHome(rooms: RoomDetail[] = []) {
  server.use(roomsListHandler(rooms))
  // HomeScreen renders inside the shell, which needs the router, so render the "/" route.
  const result = await renderRoute('/')
  // Let the room list settle.
  await within(screen.getByRole('main')).findByRole('heading', { level: 2 })
  return result
}

describe('HomeScreen', () => {
  it('titles the page "Home" with a single h1', async () => {
    await renderHome()

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
  })

  it('explains that rooms are private in the empty state', async () => {
    await renderHome()

    expect(screen.getByRole('heading', { level: 2, name: 'Rooms are private' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Nobody can find a room without an invite from someone inside it. Create one for your squad, or paste an invite link you were sent.',
      ),
    ).toBeInTheDocument()
  })

  it('offers to create a room or paste an invite link from the main area', async () => {
    await renderHome()

    const main = screen.getByRole('main')
    expect(main).toContainElement(screen.getByRole('heading', { name: 'Rooms are private' }))
    // The rail has its own "Create a room" button, so scope to the empty state's section.
    const createButtons = screen.getAllByRole('button', { name: 'Create a room' })
    expect(createButtons.filter((button) => main.contains(button))).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: 'Have an invite link? Paste it here' }),
    ).toBeInTheDocument()
  })

  it('lists your rooms as links, with your role', async () => {
    await renderHome([nightOwls, raidNight, rockAndStone, pitLane])

    const main = screen.getByRole('main')
    const links = within(within(main).getByRole('list')).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      '🦉Night OwlsOwner',
      '⚔️Raid NightAdmin',
      '⛏️Rock and Stone',
      '🏎️Pit Lane',
    ])
    expect(links[0]).toHaveAttribute('href', roomPath(nightOwls))
    expect(screen.getByRole('heading', { level: 2, name: 'Your rooms' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Rooms are private' })).not.toBeInTheDocument()
    // With rooms, Create a room moves to the header.
    expect(within(main).getByRole('button', { name: 'Create a room' })).toBeInTheDocument()
  })

  it('shows loading placeholders while the rooms load, without the empty state', async () => {
    server.use(http.get('*/api/rooms', () => new Promise<never>(() => {})))

    await renderRoute('/')

    const main = screen.getByRole('main')
    expect(within(main).getByRole('status', { name: 'Loading rooms' })).toBeInTheDocument()
    expect(within(main).queryByRole('heading', { name: 'Rooms are private' })).not.toBeInTheDocument()
    expect(within(main).queryByRole('heading', { name: 'Your rooms' })).not.toBeInTheDocument()
  })

  it('explains an unreachable API and retries', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/rooms', () => HttpResponse.error()))
    await renderRoute('/')

    // One automatic retry for an unreachable API before the error shows.
    const alert = await screen.findByRole('alert', {}, { timeout: 3000 })
    expect(alert).toHaveTextContent("Couldn't reach Hideout. Check your connection and try again.")

    server.use(roomsListHandler([nightOwls]))
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))

    const main = screen.getByRole('main')
    expect(await within(main).findByRole('link', { name: /Night Owls/ })).toBeInTheDocument()
  })

  it('keeps your rooms on screen when a background refetch fails', async () => {
    const { queryClient } = await renderHome([nightOwls, pitLane])
    const main = screen.getByRole('main')

    // A 422 isn't retried, so the refetch fails straight away.
    server.use(
      http.get('*/api/rooms', () =>
        HttpResponse.json({ error: { code: 'VALIDATION_FAILED', message: 'Bad.' } }, { status: 422 }),
      ),
    )
    await act(() => queryClient.refetchQueries({ queryKey: roomKeys.list }))

    expect(queryClient.getQueryState(roomKeys.list)?.status).toBe('error')
    expect(within(main).getByRole('link', { name: /Night Owls/ })).toBeInTheDocument()
    expect(within(main).queryByRole('alert')).not.toBeInTheDocument()
  })
})
