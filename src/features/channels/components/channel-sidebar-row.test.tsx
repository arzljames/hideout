import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { channelNav } from '@/test/channels'
import { failOnConsoleError } from '@/test/console-guard'
import { nightOwls, pitLane, raidNight, roomPath } from '@/test/fixtures/rooms'
import { renderRoute } from '@/test/render'

failOnConsoleError()

const MENU_ITEMS = ['Rename', 'Move up', 'Move down', 'Delete']

describe('Channel management controls in the sidebar', () => {
  it.each([
    ['the owner', nightOwls, 'general'],
    ['an admin', raidNight, 'lobby'],
  ])('gives %s a labelled … menu and grip for every channel', async (_label, room, open) => {
    await renderRoute(roomPath(room, open))
    const nav = channelNav()

    for (const channel of room.channels) {
      expect(
        within(nav).getByRole('button', { name: `Channel options for #${channel.name}` }),
      ).toBeInTheDocument()
      expect(within(nav).getByRole('button', { name: `Reorder #${channel.name}` })).toBeInTheDocument()
    }
    expect(within(nav).getByRole('button', { name: 'Create text channel' })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Create voice channel' })).toBeInTheDocument()
  })

  it('gives a plain member only the channel links: no +, … menus, grips or context menu', async () => {
    const user = userEvent.setup()
    await renderRoute(roomPath(pitLane, 'paddock'))
    const nav = channelNav()

    expect(within(nav).getAllByRole('link').map((link) => link.textContent?.trim())).toEqual([
      'paddock',
      'grid',
    ])
    expect(within(nav).queryByRole('button', { name: /^Create .* channel$/ })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('button', { name: /^Channel options for/ })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('button', { name: /^Reorder / })).not.toBeInTheDocument()

    await user.pointer({ keys: '[MouseRight]', target: within(nav).getByRole('link', { name: 'paddock' }) })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens the same actions from a right-click on the channel link', async () => {
    const user = userEvent.setup()
    await renderRoute(roomPath(nightOwls, 'general'))
    const nav = channelNav()

    await user.click(within(nav).getByRole('button', { name: 'Channel options for #clips' }))
    const dropdown = await screen.findByRole('menu')
    expect(within(dropdown).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(MENU_ITEMS)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())

    await user.pointer({ keys: '[MouseRight]', target: within(nav).getByRole('link', { name: 'clips' }) })
    const contextMenu = await screen.findByRole('menu')
    expect(within(contextMenu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(
      MENU_ITEMS,
    )
  })

  it('disables Move up for the first channel in its context menu', async () => {
    const user = userEvent.setup()
    await renderRoute(roomPath(nightOwls, 'general'))

    await user.pointer({
      keys: '[MouseRight]',
      target: within(channelNav()).getByRole('link', { name: 'general' }),
    })
    const menu = await screen.findByRole('menu')

    expect(within(menu).getByRole('menuitem', { name: 'Move up' })).toHaveAttribute('aria-disabled', 'true')
    expect(within(menu).getByRole('menuitem', { name: 'Move down' })).not.toHaveAttribute('aria-disabled')
  })

  it('Rename from the context menu returns focus to the row’s … button on Escape', async () => {
    const user = userEvent.setup()
    await renderRoute(roomPath(nightOwls, 'general'))
    const nav = channelNav()

    await user.pointer({ keys: '[MouseRight]', target: within(nav).getByRole('link', { name: 'clips' }) })
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }))
    const dialog = await screen.findByRole('dialog', { name: 'Rename #clips' })
    expect(within(dialog).getByRole('textbox', { name: 'Channel name' })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(within(nav).getByRole('button', { name: 'Channel options for #clips' })).toHaveFocus(),
    )
  })
})

describe('Channel management controls in Room settings', () => {
  it('gives an admin Create, Reorder, Move, Rename and Delete for every channel', async () => {
    await renderRoute(`${roomPath(raidNight)}/settings?section=channels`)

    expect(screen.getAllByRole('button', { name: 'Create channel' })).toHaveLength(2)
    for (const channel of raidNight.channels) {
      for (const name of [
        `Reorder #${channel.name}`,
        `Move ${channel.name} up`,
        `Move ${channel.name} down`,
        `Rename ${channel.name}`,
        `Delete ${channel.name}`,
      ]) {
        expect(screen.getByRole('button', { name })).toBeInTheDocument()
      }
    }
  })

  it('shows a plain member no channel controls', async () => {
    await renderRoute(`${roomPath(pitLane)}/settings?section=channels`)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Only the owner and admins can change room settings',
    )
    expect(screen.queryByRole('button', { name: 'Create channel' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^(Reorder|Rename|Delete|Move) / }),
    ).not.toBeInTheDocument()
  })
})
