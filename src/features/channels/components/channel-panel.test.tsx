import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failOnConsoleError } from '@/test/console-guard'
import { nightOwls, pitLane, raidNight, roomPath } from '@/test/fixtures/rooms'
import { renderRoute } from '@/test/render'
import { withViewportWidth } from '@/test/viewport'

failOnConsoleError()

async function renderGeneral() {
  const user = userEvent.setup()
  const result = await renderRoute(roomPath(nightOwls, 'general'))
  const channels = screen.getByRole('navigation', { name: 'Channels' })
  return { user, channels, ...result }
}

describe('ChannelPanel', () => {
  it('groups channels into labelled text and voice lists', async () => {
    const { channels } = await renderGeneral()

    const text = within(channels).getByRole('list', { name: 'Text channels' })
    expect(within(text).getAllByRole('link').map((link) => link.textContent?.trim())).toEqual([
      'general',
      'clips',
      'planning',
    ])

    const voice = within(channels).getByRole('list', { name: 'Voice channels' })
    expect(within(voice).getAllByRole('link').map((link) => link.textContent?.trim())).toEqual([
      'voice',
      'late night',
    ])
    expect(within(voice).getByRole('link', { name: 'late night' })).toHaveAttribute(
      'href',
      roomPath(nightOwls, 'late night'),
    )
  })

  it('offers Create channel actions to the owner', async () => {
    const { channels } = await renderGeneral()

    expect(within(channels).getByRole('button', { name: 'Create text channel' })).toBeInTheDocument()
    expect(within(channels).getByRole('button', { name: 'Create voice channel' })).toBeInTheDocument()
  })

  it('offers Create channel actions to an admin', async () => {
    await renderRoute(roomPath(raidNight, 'lobby'))
    const channels = screen.getByRole('navigation', { name: 'Channels' })

    expect(within(channels).getByRole('button', { name: 'Create text channel' })).toBeInTheDocument()
  })

  it('hides Create channel actions from a plain member', async () => {
    await renderRoute(roomPath(pitLane, 'paddock'))
    const channels = screen.getByRole('navigation', { name: 'Channels' })

    expect(within(channels).queryByRole('button', { name: /^Create .* channel$/ })).not.toBeInTheDocument()
  })

  it('marks only the open channel with aria-current', async () => {
    const { channels } = await renderGeneral()

    expect(within(channels).getByRole('link', { name: 'general' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const current = within(channels)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(1)
  })

  it('moves aria-current when another channel is opened', async () => {
    const { user, channels, router } = await renderGeneral()

    await user.click(within(channels).getByRole('link', { name: 'clips' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'clips' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'clips'))
    expect(within(channels).getByRole('link', { name: 'clips' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(channels).getByRole('link', { name: 'general' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('opens room actions from the room menu', async () => {
    const { user } = await renderGeneral()

    await user.click(screen.getByRole('button', { name: 'Night Owls' }))

    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Invite people',
      'Room settings',
    ])
    // The owner can't leave: no Leave room item.
  })

  it('opens Invite people from the room menu and returns focus to the menu button on close', async () => {
    const { user } = await renderGeneral()
    const menuButton = screen.getByRole('button', { name: 'Night Owls' })

    await user.click(menuButton)
    await user.click(await screen.findByRole('menuitem', { name: 'Invite people' }))

    const dialog = await screen.findByRole('dialog', { name: 'Invite people to Night Owls' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(menuButton).toHaveFocus()
  })

  it('opens Invite people from the room menu with the keyboard', async () => {
    const { user } = await renderGeneral()
    const menuButton = screen.getByRole('button', { name: 'Night Owls' })
    act(() => menuButton.focus())

    await user.keyboard('{Enter}')
    await screen.findByRole('menu')
    await user.keyboard('{Enter}')

    await screen.findByRole('dialog', { name: 'Invite people to Night Owls' })
    await user.click(screen.getByRole('button', { name: 'Done' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(menuButton).toHaveFocus()
  })
})

describe('ChannelPanel on mobile', () => {
  withViewportWidth(500)

  it('opens Invite people from the room menu inside the navigation sheet and returns focus there', async () => {
    const user = userEvent.setup()
    await renderRoute(roomPath(nightOwls, 'general'))

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    const nav = await screen.findByRole('dialog', { name: 'Navigation' })
    const menuButton = within(nav).getByRole('button', { name: 'Night Owls' })
    await user.click(menuButton)
    await user.click(await screen.findByRole('menuitem', { name: 'Invite people' }))
    await screen.findByRole('dialog', { name: 'Invite people to Night Owls' })

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Invite people to Night Owls' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument()
    expect(menuButton).toHaveFocus()
  })

  // Following a link inside the mobile sheet must not leave the overlay covering the new page.
  it('closes the navigation sheet after you pick a channel', async () => {
    const user = userEvent.setup()
    await renderRoute(roomPath(nightOwls, 'general'))

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    const nav = await screen.findByRole('dialog', { name: 'Navigation' })
    await user.click(within(nav).getByRole('link', { name: 'planning' }))
    await screen.findByRole('heading', { level: 1, name: 'planning' })

    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()
  })
})
