import { screen, within } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { meQueryOptions } from '@/features/auth'
import type { RoomDetail } from '@/features/rooms'
import { failOnConsoleError } from '@/test/console-guard'
import { meFixture } from '@/test/fixtures/me'
import { nightOwls, raidNight, roomPath } from '@/test/fixtures/rooms'
import { createTestQueryClient, renderRoute, renderWithProviders } from '@/test/render'
import { MembersSection } from './members-section'

failOnConsoleError()

async function renderMembers(room: RoomDetail = nightOwls) {
  const user = userEvent.setup()
  await renderRoute(`${roomPath(room)}/settings?section=members`)
  // Every role group's list lives in <main>.
  return { user, list: screen.getByRole('main') }
}

function row(list: HTMLElement, name: string) {
  const item = within(list)
    .getAllByRole('listitem')
    .find((li) => within(li).queryByText(name, { exact: true }))
  if (!item) throw new Error(`No row for ${name}`)
  return item
}

describe('Members section (owner)', () => {
  it('lists every member with a count', async () => {
    const { list } = await renderMembers()

    expect(within(list).getAllByRole('listitem')).toHaveLength(7)
    expect(screen.getByText('7 members')).toBeInTheDocument()
  })

  it('groups members into Owner, Admins and Members lists', async () => {
    await renderMembers()

    expect(within(screen.getByRole('list', { name: 'Owner — 1' })).getByText('Arzl')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Admins — 1' })).getByText('Maya')).toBeInTheDocument()
    expect(
      within(screen.getByRole('list', { name: 'Members — 5' })).getAllByRole('listitem'),
    ).toHaveLength(5)
  })

  it('shows role badges, marks you, and says when each member joined', async () => {
    const { list } = await renderMembers()

    expect(row(list, 'Arzl')).toHaveTextContent('Owner')
    expect(row(list, 'Arzl')).toHaveTextContent('(you)')
    expect(row(list, 'Maya')).toHaveTextContent('Admin')
    expect(row(list, 'Jun')).not.toHaveTextContent(/Owner|Admin/)
    for (const item of within(list).getAllByRole('listitem')) {
      expect(item).toHaveTextContent(/Joined \S+/)
      expect(item.querySelector('time')?.getAttribute('dateTime')).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    }
  })

  it('offers no actions for the owner or for yourself', async () => {
    const { list } = await renderMembers()

    // Arzl is both the owner and you.
    expect(within(row(list, 'Arzl')).queryByRole('button')).not.toBeInTheDocument()
    expect(within(list).getAllByRole('button', { name: /^Actions for / })).toHaveLength(6)
  })

  it("offers Remove admin and Remove from room for an admin (Maya)", async () => {
    const { user, list } = await renderMembers()

    await user.click(within(list).getByRole('button', { name: 'Actions for Maya' }))
    const menu = await screen.findByRole('menu')

    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Remove admin',
      'Remove from room',
    ])
  })

  it('offers Make admin and Remove from room for a plain member (Jun)', async () => {
    const { user, list } = await renderMembers()

    await user.click(within(list).getByRole('button', { name: 'Actions for Jun' }))
    const menu = await screen.findByRole('menu')

    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Make admin',
      'Remove from room',
    ])
  })

  it('confirms Remove from room and returns focus to the actions button on Cancel', async () => {
    const { user, list } = await renderMembers()
    const trigger = within(list).getByRole('button', { name: 'Actions for Maya' })

    await user.click(trigger)
    await user.click(await screen.findByRole('menuitem', { name: 'Remove from room' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Remove Maya from Night Owls?' })
    expect(dialog).toHaveAccessibleDescription(
      "They'll lose access to every channel. They can rejoin with a new invite.",
    )
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('returns focus to the actions button when the remove confirmation is dismissed with Escape', async () => {
    const { user, list } = await renderMembers()
    const trigger = within(list).getByRole('button', { name: 'Actions for Jun' })

    await user.click(trigger)
    await user.click(await screen.findByRole('menuitem', { name: 'Remove from room' }))
    await screen.findByRole('alertdialog', { name: 'Remove Jun from Night Owls?' })
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('keeps one empty status region while the list is unfiltered', async () => {
    await renderMembers()

    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('filters members as you search, case-insensitively', async () => {
    const { user } = await renderMembers()
    const search = screen.getByRole('searchbox', { name: 'Search members' })
    const status = screen.getByRole('status')

    await user.type(search, 'PRI')

    // The same region, updated in place.
    expect(screen.getByRole('status')).toBe(status)
    expect(status).toHaveTextContent('1 of 7 members')

    const list = screen.getByRole('list', { name: 'Members — 1' })
    expect(within(screen.getByRole('main')).getAllByRole('listitem')).toHaveLength(1)
    expect(within(list).getByText('Priya')).toBeInTheDocument()
    // The total in the header doesn't change while filtering.
    expect(screen.getByText('7 members')).toBeInTheDocument()
  })

  it('says when no member matches, and recovers when the search is cleared', async () => {
    const { user } = await renderMembers()
    const search = screen.getByRole('searchbox', { name: 'Search members' })

    await user.type(search, 'zz')

    expect(within(screen.getByRole('main')).queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('No members match “zz”')

    await user.clear(search)

    expect(within(screen.getByRole('main')).getAllByRole('listitem')).toHaveLength(7)
    expect(screen.getByRole('status')).toHaveTextContent('')
  })
})

describe('Members section (admin)', () => {
  it('in Raid Night, shows no actions: the owner and yourself are off limits', async () => {
    const { list } = await renderMembers(raidNight)

    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(row(list, 'Theo')).toHaveTextContent('Owner')
    expect(row(list, 'Arzl')).toHaveTextContent('Admin')
    expect(row(list, 'Arzl')).toHaveTextContent('(you)')
    expect(within(list).queryByRole('button', { name: /^Actions for / })).not.toBeInTheDocument()
    expect(screen.getByText('2 members')).toBeInTheDocument()
  })

  it('can only remove plain members and never change roles', async () => {
    // Raid Night has no plain members, so use Night Owls' members with you as an admin.
    const [arzl, maya, ...rest] = nightOwls.members
    if (!arzl || !maya) throw new Error('fixture members missing')
    const asAdmin: RoomDetail = {
      ...nightOwls,
      myRole: 'admin',
      members: [{ ...maya, role: 'owner' }, { ...arzl, role: 'admin' }, ...rest.slice(0, 1)],
    }
    const user = userEvent.setup()
    // MembersSection finds you through the session query.
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(meQueryOptions.queryKey, meFixture)
    renderWithProviders(
      <QueryClientProvider client={queryClient}>
        <MembersSection room={asAdmin} />
      </QueryClientProvider>,
    )

    const page = document.body
    expect(
      within(page)
        .getAllByRole('button', { name: /^Actions for / })
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Actions for Alex'])

    await user.click(within(page).getByRole('button', { name: 'Actions for Alex' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Remove from room',
    ])
  })
})
