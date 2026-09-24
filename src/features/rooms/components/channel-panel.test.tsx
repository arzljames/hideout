import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failOnConsoleError } from '@/test/console-guard'
import { renderRoute } from '@/test/render'
import { withViewportWidth } from '@/test/viewport'

failOnConsoleError()

async function renderGeneral() {
  const user = userEvent.setup()
  const result = await renderRoute('/rooms/night-owls/general')
  const channels = screen.getByRole('navigation', { name: 'Channels' })
  return { user, channels, ...result }
}

/** The participant row under a voice channel that contains `name`. */
function participantRow(list: HTMLElement, name: string) {
  const row = within(list)
    .getAllByRole('listitem')
    .find((item) => within(item).queryByText(name, { exact: false }))
  if (!row) throw new Error(`No participant row for ${name}`)
  return row
}

describe('ChannelPanel', () => {
  it('groups channels into labelled text and voice lists', async () => {
    const { channels } = await renderGeneral()

    const text = within(channels).getByRole('list', { name: 'Text channels' })
    expect(within(text).getAllByRole('link').map((link) => link.textContent?.trim())).toEqual([
      'general',
      'clips (unread)',
      'planning',
    ])

    const voice = within(channels).getByRole('list', { name: 'Voice channels' })
    expect(within(voice).getByRole('link', { name: 'voice (connected)' })).toBeInTheDocument()
    expect(within(voice).getByRole('link', { name: 'late night' })).toBeInTheDocument()

    expect(within(channels).getByRole('button', { name: 'Create text channel' })).toBeInTheDocument()
    expect(within(channels).getByRole('button', { name: 'Create voice channel' })).toBeInTheDocument()
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

  it('announces the unread channel as unread', async () => {
    const { channels } = await renderGeneral()

    expect(within(channels).getByRole('link', { name: 'clips (unread)' })).toHaveAttribute(
      'href',
      '/rooms/night-owls/clips',
    )
    expect(within(channels).queryByRole('link', { name: 'planning (unread)' })).not.toBeInTheDocument()
  })

  it('moves aria-current when another channel is opened, and drops its unread label', async () => {
    const { user, channels, router } = await renderGeneral()

    await user.click(within(channels).getByRole('link', { name: 'clips (unread)' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'clips' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/rooms/night-owls/clips')
    expect(within(channels).getByRole('link', { name: 'clips' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(channels).getByRole('link', { name: 'general' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('lists voice participants with muted, deafened and speaking labels', async () => {
    const { channels } = await renderGeneral()

    const inVoice = within(channels).getByRole('list', { name: 'In voice' })
    expect(within(inVoice).getAllByRole('listitem')).toHaveLength(5)
    expect(participantRow(inVoice, 'Maya')).toHaveTextContent(/Maya, speaking/)
    expect(participantRow(inVoice, 'Jun')).toHaveTextContent(/Jun\s*muted/)
    // Deafened takes precedence over muted.
    expect(participantRow(inVoice, 'Priya')).toHaveTextContent(/Priya\s*deafened/)
    expect(participantRow(inVoice, 'Priya')).not.toHaveTextContent(/muted/)
    expect(participantRow(inVoice, 'Alex')).not.toHaveTextContent(/muted|deafened|speaking/)
    // The empty voice channel lists nobody.
    expect(within(channels).queryByRole('list', { name: 'In late night' })).not.toBeInTheDocument()
  })

  it("reflects the viewer's own mute and deafen from the voice controls", async () => {
    const { user, channels } = await renderGeneral()
    const inVoice = within(channels).getByRole('list', { name: 'In voice' })
    expect(participantRow(inVoice, 'Arzl')).not.toHaveTextContent(/muted|deafened/)

    await user.click(screen.getByRole('button', { name: 'Mute' }))
    expect(participantRow(inVoice, 'Arzl')).toHaveTextContent(/muted/)

    await user.click(screen.getByRole('button', { name: 'Deafen' }))
    expect(participantRow(inVoice, 'Arzl')).toHaveTextContent(/deafened/)
  })

  it('opens room actions from the room menu', async () => {
    const { user } = await renderGeneral()

    await user.click(screen.getByRole('button', { name: 'Night Owls' }))

    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Invite people',
      'Room settings',
      'Leave room',
    ])
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
    await renderRoute('/rooms/night-owls/general')

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
    await renderRoute('/rooms/night-owls/general')

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    const nav = await screen.findByRole('dialog', { name: 'Navigation' })
    await user.click(within(nav).getByRole('link', { name: 'planning' }))
    await screen.findByRole('heading', { level: 1, name: 'planning' })

    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()
  })
})
