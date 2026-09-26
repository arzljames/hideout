import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failOnConsoleError } from '@/test/console-guard'
import { renderRoute } from '@/test/render'
import { withViewportWidth } from '@/test/viewport'

failOnConsoleError()

const SETTINGS = '/rooms/night-owls/settings'

function sectionNav() {
  return screen.getByRole('navigation', { name: 'Room settings sections' })
}

function expectOneMainAndH1(title: string) {
  expect(screen.getAllByRole('main')).toHaveLength(1)
  const headings = screen.getAllByRole('heading', { level: 1 })
  expect(headings).toHaveLength(1)
  expect(headings[0]).toHaveTextContent(title)
}

describe('Room settings routes', () => {
  it('renders full screen, without the app shell, on Overview', async () => {
    const { router } = await renderRoute(SETTINGS)

    expect(router.state.matches.at(-1)?.routeId).toBe('/_focus/rooms/$roomId/settings')
    expect(screen.queryByRole('navigation', { name: 'Rooms' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Channels' })).not.toBeInTheDocument()
    expectOneMainAndH1('Overview')
    expect(screen.getByRole('complementary', { name: 'Night Owls settings' })).toBeInTheDocument()
  })

  it('marks the current section in the settings nav', async () => {
    await renderRoute(SETTINGS)

    const nav = sectionNav()
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Overview',
      'Members',
      'Invites',
      'Channels',
    ])
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    for (const name of ['Members', 'Invites', 'Channels']) {
      expect(within(nav).getByRole('link', { name })).not.toHaveAttribute('aria-current')
    }
  })

  it.each([
    ['members', 'Members'],
    ['invites', 'Invites'],
    ['channels', 'Channels'],
    ['overview', 'Overview'],
  ])('?section=%s shows the %s section', async (section, title) => {
    await renderRoute(`${SETTINGS}?section=${section}`)

    expectOneMainAndH1(title)
    expect(within(sectionNav()).getByRole('link', { name: title })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('falls back to Overview for an unknown section', async () => {
    await renderRoute(`${SETTINGS}?section=nope`)

    expectOneMainAndH1('Overview')
    expect(within(sectionNav()).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('switches sections from the nav', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute(SETTINGS)

    await user.click(within(sectionNav()).getByRole('link', { name: 'Members' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Members' })).toBeInTheDocument()
    expect(router.state.location.search).toEqual({ section: 'members' })
    expect(within(sectionNav()).getByRole('link', { name: 'Members' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('treats "settings" as the settings page, not a channel called settings', async () => {
    const { router } = await renderRoute(SETTINGS)

    expect(router.state.matches.some((match) => match.routeId.includes('$channelId'))).toBe(false)
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument()
    expect(screen.queryByText("This channel doesn't exist")).not.toBeInTheDocument()
  })

  it('shows the room-not-available screen for an unknown room', async () => {
    await renderRoute('/rooms/nope/settings')

    expectOneMainAndH1("This room isn't available")
    expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/')
  })

  it('tells a plain member that only the owner and admins can change settings', async () => {
    await renderRoute('/rooms/pit-lane/settings')

    expectOneMainAndH1('Only the owner and admins can change room settings')
    expect(screen.getByRole('link', { name: 'Back to Pit Lane' })).toHaveAttribute(
      'href',
      '/rooms/pit-lane/paddock',
    )
    expect(screen.queryByRole('navigation', { name: 'Room settings sections' })).not.toBeInTheDocument()
  })

  it('gives an admin Overview without the owner-only Delete room zone', async () => {
    await renderRoute('/rooms/raid-night/settings')

    expectOneMainAndH1('Overview')
    expect(screen.getByRole('textbox', { name: 'Room name' })).toHaveValue('Raid Night')
    expect(screen.queryByRole('region', { name: 'Delete room' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete room' })).not.toBeInTheDocument()
  })

  it('gives the owner the Delete room zone', async () => {
    await renderRoute(SETTINGS)

    const zone = screen.getByRole('region', { name: 'Delete room' })
    expect(within(zone).getByRole('button', { name: 'Delete room' })).toBeInTheDocument()
  })
})

describe('Room menu → Room settings', () => {
  it('is a link to settings for the owner', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute('/rooms/night-owls/general')

    await user.click(screen.getByRole('button', { name: 'Night Owls' }))
    const item = await screen.findByRole('menuitem', { name: 'Room settings' })
    expect(item).toHaveAttribute('href', SETTINGS)

    await user.click(item)

    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(SETTINGS)
  })

  it('is offered to an admin', async () => {
    const user = userEvent.setup()
    await renderRoute('/rooms/raid-night/lobby')

    await user.click(screen.getByRole('button', { name: 'Raid Night' }))

    expect(await screen.findByRole('menuitem', { name: 'Room settings' })).toHaveAttribute(
      'href',
      '/rooms/raid-night/settings',
    )
  })

  it('is absent for a plain member', async () => {
    const user = userEvent.setup()
    await renderRoute('/rooms/pit-lane/paddock')

    await user.click(screen.getByRole('button', { name: 'Pit Lane' }))
    const menu = await screen.findByRole('menu')

    expect(within(menu).queryByRole('menuitem', { name: 'Room settings' })).not.toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Invite people' })).toBeInTheDocument()
  })
})

describe('Closing Room settings', () => {
  it('has a Close settings link back to the default channel', async () => {
    await renderRoute(SETTINGS)

    const close = screen.getByRole('link', { name: 'Close settings' })
    expect(close).toHaveAttribute('href', '/rooms/night-owls/general')
    expect(close).toHaveAttribute('aria-keyshortcuts', 'Escape')
  })

  it('goes back to the room from Close settings', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute(SETTINGS)

    await user.click(screen.getByRole('link', { name: 'Close settings' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'general' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/rooms/night-owls/general')
  })

  it('tabs through the section nav, then Close, then the Overview fields', async () => {
    const user = userEvent.setup()
    await renderRoute(SETTINGS)

    const order: string[] = []
    for (let step = 0; step < 6; step++) {
      await user.tab()
      const focused = document.activeElement as HTMLElement
      order.push(focused.getAttribute('aria-label') ?? focused.textContent?.trim() ?? '')
    }

    expect(order).toEqual([
      'Overview',
      'Members',
      'Invites',
      'Channels',
      'Close settings',
      'Change emoji',
    ])
  })

  it('goes back to the room on Escape', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute(`${SETTINGS}?section=members`)

    await user.keyboard('{Escape}')

    expect(await screen.findByRole('log', { name: 'Messages in #general' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/rooms/night-owls/general')
  })

  it('stays on the page when Escape comes from a member search box with text', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute(`${SETTINGS}?section=members`)
    const search = screen.getByRole('searchbox', { name: 'Search members' })

    await user.type(search, 'pri')
    await user.keyboard('{Escape}')

    expect(router.state.location.pathname).toBe(SETTINGS)
    expect(screen.getByRole('heading', { level: 1, name: 'Members' })).toBeInTheDocument()
  })

  it('closes on Escape from an empty member search box', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute(`${SETTINGS}?section=members`)

    await user.click(screen.getByRole('searchbox', { name: 'Search members' }))
    await user.keyboard('{Escape}')

    expect(await screen.findByRole('log', { name: 'Messages in #general' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/rooms/night-owls/general')
  })

  it('stays on the page when Escape comes from the Room name field (keeps unsaved edits)', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute(SETTINGS)
    const name = screen.getByRole('textbox', { name: 'Room name' })

    await user.type(name, ' 2')
    await user.keyboard('{Escape}')

    expect(router.state.location.pathname).toBe(SETTINGS)
    expect(name).toHaveValue('Night Owls 2')
  })

  it('closes the emoji popover first on Escape, then settings on a second Escape', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute(SETTINGS)
    const change = screen.getByRole('button', { name: 'Change emoji' })

    await user.click(change)
    await screen.findByRole('radiogroup', { name: 'Room icon' })
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('radiogroup', { name: 'Room icon' })).not.toBeInTheDocument()
    expect(change).toHaveFocus()
    expect(router.state.location.pathname).toBe(SETTINGS)

    await user.keyboard('{Escape}')

    expect(await screen.findByRole('heading', { level: 1, name: 'general' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/rooms/night-owls/general')
  })

  it('closes only the delete dialog on Escape', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute(SETTINGS)

    await user.click(screen.getByRole('button', { name: 'Delete room' }))
    await screen.findByRole('alertdialog', { name: 'Delete Night Owls?' })
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe(SETTINGS)
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument()
  })

  it("closes only a member's actions menu on Escape", async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute(`${SETTINGS}?section=members`)
    const trigger = screen.getByRole('button', { name: 'Actions for Maya' })

    await user.click(trigger)
    await screen.findByRole('menu')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(router.state.location.pathname).toBe(SETTINGS)
  })

  it('closes only the Create invite link dialog on Escape', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute(`${SETTINGS}?section=invites`)

    await user.click(screen.getByRole('button', { name: 'Create invite link' }))
    await screen.findByRole('dialog', { name: 'Invite people to Night Owls' })
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe(SETTINGS)
  })

  it('closes only an open select inside the invite dialog on Escape', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute(`${SETTINGS}?section=invites`)

    await user.click(screen.getByRole('button', { name: 'Create invite link' }))
    const dialog = await screen.findByRole('dialog', { name: 'Invite people to Night Owls' })
    await user.click(within(dialog).getByRole('combobox', { name: 'Expire after' }))
    await screen.findByRole('listbox')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Invite people to Night Owls' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(SETTINGS)
  })
})

describe('Room settings keyboard order', () => {
  it('tabs through the section nav, then Close, then the Overview fields', async () => {
    const user = userEvent.setup()
    await renderRoute(SETTINGS)

    const expected = [
      screen.getByRole('link', { name: 'Overview' }),
      screen.getByRole('link', { name: 'Members' }),
      screen.getByRole('link', { name: 'Invites' }),
      screen.getByRole('link', { name: 'Channels' }),
      screen.getByRole('link', { name: 'Close settings' }),
      screen.getByRole('button', { name: 'Change emoji' }),
      screen.getByRole('button', { name: 'Upload image' }),
      screen.getByRole('textbox', { name: 'Room name' }),
      // Save changes is disabled until the form changes, so it's skipped here.
      screen.getByRole('button', { name: 'Delete room' }),
    ]
    for (const element of expected) {
      await user.tab()
      expect(element).toHaveFocus()
    }
  })

  it('includes Save changes once the form has changed', async () => {
    const user = userEvent.setup()
    await renderRoute(SETTINGS)

    const name = screen.getByRole('textbox', { name: 'Room name' })
    await user.type(name, '!')
    await user.tab()

    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveFocus()
  })
})

describe('Room settings on mobile', () => {
  withViewportWidth(500)

  it('shows a single horizontal section nav in the top bar with aria-current', async () => {
    await renderRoute(`${SETTINGS}?section=members`)

    const navs = screen.getAllByRole('navigation', { name: 'Room settings sections' })
    expect(navs).toHaveLength(1)
    const banner = screen.getByRole('banner')
    expect(banner).toContainElement(navs[0] ?? null)
    expect(within(banner).getByRole('link', { name: 'Members' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('complementary', { name: 'Night Owls settings' })).not.toBeInTheDocument()
    expectOneMainAndH1('Members')
  })

  it('keeps a Close settings link in the top bar, without the Esc caption', async () => {
    await renderRoute(SETTINGS)

    const closes = screen.getAllByRole('link', { name: 'Close settings' })
    expect(closes).toHaveLength(1)
    expect(screen.getByRole('banner')).toContainElement(closes[0] ?? null)
    expect(screen.queryByText('Esc')).not.toBeInTheDocument()
  })
})
