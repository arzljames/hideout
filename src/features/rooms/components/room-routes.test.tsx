import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failOnConsoleError } from '@/test/console-guard'
import { renderRoute } from '@/test/render'

failOnConsoleError()

// Route tests for /rooms/$roomId, /rooms/$roomId/ and /rooms/$roomId/$channelId, plus the
// rail and nav panel, which depend on the matched route. (Kept out of src/routes so the router
// plugin doesn't treat the test as a route file.)

describe('room routes', () => {
  it('redirects /rooms/night-owls to its default text channel, #general', async () => {
    const { router } = await renderRoute('/rooms/night-owls')

    expect(router.state.location.pathname).toBe('/rooms/night-owls/general')
    expect(screen.getByRole('heading', { level: 1, name: 'general' })).toBeInTheDocument()
  })

  it('shows "This room isn\'t available" with a Home link for an unknown room', async () => {
    const { router } = await renderRoute('/rooms/nope/general')

    expect(
      screen.getByRole('heading', { level: 2, name: "This room isn't available" }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/')
    // No channel panel for a room you can't see.
    expect(screen.queryByRole('navigation', { name: 'Channels' })).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/rooms/nope/general')
  })

  it('shows the same not-available screen for an unknown room without a channel', async () => {
    await renderRoute('/rooms/nope')

    expect(
      screen.getByRole('heading', { level: 2, name: "This room isn't available" }),
    ).toBeInTheDocument()
  })

  it('goes Home from the not-available screen', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute('/rooms/nope/general')

    await user.click(screen.getByRole('link', { name: 'Go to Home' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('shows "This channel doesn\'t exist" inside the room layout for an unknown channel', async () => {
    await renderRoute('/rooms/night-owls/nope')

    expect(
      screen.getByRole('heading', { level: 2, name: "This channel doesn't exist" }),
    ).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Channels' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Night Owls' })).toHaveAttribute(
      'href',
      '/rooms/night-owls/general',
    )
  })

  it('renders the participant grid for a voice channel', async () => {
    await renderRoute('/rooms/night-owls/voice')

    expect(screen.getByRole('heading', { level: 1, name: 'voice' })).toBeInTheDocument()
    const participants = screen.getByRole('list', { name: 'Participants' })
    expect(within(participants).getAllByRole('listitem')).toHaveLength(5)
  })

  it.each([
    ['/', 'Home'],
    ['/rooms/night-owls/general', 'general'],
    ['/rooms/night-owls/clips', 'clips'],
    ['/rooms/night-owls/voice', 'voice'],
    ['/rooms/night-owls/late-night', 'late night'],
    ['/rooms/raid-night/lobby', 'lobby'],
    ['/rooms/night-owls/nope', 'Channel not found'],
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
    await renderRoute('/rooms/night-owls/general')

    const rail = screen.getByRole('navigation', { name: 'Rooms' })
    const home = within(rail).getByRole('link', { name: 'Home, 3 pending invites' })
    expect(home).toHaveAttribute('href', '/')
    expect(home).not.toHaveAttribute('aria-current')
  })

  it('links each room tile to its room and marks the open room as current', async () => {
    await renderRoute('/rooms/night-owls/general')

    const rail = screen.getByRole('navigation', { name: 'Rooms' })
    const rooms = [
      ['Night Owls', '/rooms/night-owls'],
      ['Raid Night', '/rooms/raid-night'],
      ['Rock and Stone', '/rooms/deep-rock'],
      ['Pit Lane', '/rooms/pit-lane'],
    ] as const
    for (const [name, href] of rooms) {
      expect(within(rail).getByRole('link', { name })).toHaveAttribute('href', href)
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
    expect(within(rail).getByRole('link', { name: 'Night Owls' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('opens another room at its default channel from its tile', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute('/rooms/night-owls/general')

    const rail = screen.getByRole('navigation', { name: 'Rooms' })
    await user.click(within(rail).getByRole('link', { name: 'Raid Night' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'lobby' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/rooms/raid-night/lobby')
    expect(within(rail).getByRole('link', { name: 'Raid Night' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const channels = screen.getByRole('navigation', { name: 'Channels' })
    expect(within(channels).getByRole('link', { name: 'lobby' })).toHaveAttribute(
      'aria-current',
      'page',
    )
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
    await renderRoute('/rooms/night-owls/general')

    expect(screen.getByRole('navigation', { name: 'Channels' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Home sections' })).not.toBeInTheDocument()
  })
})
