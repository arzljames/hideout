import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failOnConsoleError } from '@/test/console-guard'
import { renderRoute } from '@/test/render'
import { withViewportWidth } from '@/test/viewport'

failOnConsoleError()

/** The member row (list item) for `name`. */
function memberRow(list: HTMLElement, name: string) {
  const row = within(list)
    .getAllByRole('listitem')
    .find((li) => within(li).queryByText(name, { exact: true }))
  if (!row) throw new Error(`No member row for ${name}`)
  return row
}

describe('MemberList on desktop', () => {
  it('splits members into Online — 5 and Offline — 2', async () => {
    await renderRoute('/rooms/night-owls/general')

    const members = screen.getByRole('complementary', { name: 'Members' })
    const online = within(members).getByRole('region', { name: 'Online — 5' })
    const offline = within(members).getByRole('region', { name: 'Offline — 2' })
    expect(within(online).getByRole('heading', { name: 'Online — 5' })).toBeInTheDocument()
    expect(within(online).getAllByRole('listitem')).toHaveLength(5)
    expect(within(offline).getAllByRole('listitem')).toHaveLength(2)
    expect(memberRow(offline, 'Theo')).toHaveTextContent('Offline')
    expect(memberRow(offline, 'Sam')).toHaveTextContent('Offline')
  })

  it('shows the Owner and Admin role badges and marks you', async () => {
    await renderRoute('/rooms/night-owls/general')

    const members = screen.getByRole('complementary', { name: 'Members' })
    expect(memberRow(members, 'Arzl')).toHaveTextContent('Owner')
    expect(memberRow(members, 'Arzl')).toHaveTextContent('(you)')
    expect(memberRow(members, 'Maya')).toHaveTextContent('Admin')
    expect(within(members).getAllByText(/^(Owner|Admin)$/)).toHaveLength(2)
  })

  it('shows what members are playing, and Online otherwise', async () => {
    await renderRoute('/rooms/night-owls/general')

    const members = screen.getByRole('complementary', { name: 'Members' })
    expect(memberRow(members, 'Maya')).toHaveTextContent('Playing Elden Ring')
    expect(memberRow(members, 'Alex')).toHaveTextContent('Online')
  })

  it('hides and shows the panel with the members toggle, reflected by aria-pressed', async () => {
    const user = userEvent.setup()
    await renderRoute('/rooms/night-owls/general')

    const toggle = screen.getByRole('button', { name: 'Show members' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('complementary', { name: 'Members' })).not.toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('complementary', { name: 'Members' })).toBeInTheDocument()
  })

  it('keeps the panel hidden when switching channels', async () => {
    const user = userEvent.setup()
    await renderRoute('/rooms/night-owls/general')

    await user.click(screen.getByRole('button', { name: 'Show members' }))
    const channels = screen.getByRole('navigation', { name: 'Channels' })
    await user.click(within(channels).getByRole('link', { name: 'planning' }))
    await screen.findByRole('heading', { level: 1, name: 'planning' })

    expect(screen.queryByRole('complementary', { name: 'Members' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show members' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})

describe('MemberList on mobile', () => {
  withViewportWidth(500)

  it('opens the members in a sheet from the toggle and returns focus on Escape', async () => {
    const user = userEvent.setup()
    await renderRoute('/rooms/night-owls/general')

    expect(screen.queryByRole('complementary', { name: 'Members' })).not.toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Show members' })
    expect(toggle).not.toHaveAttribute('aria-pressed')

    await user.click(toggle)

    const sheet = await screen.findByRole('dialog', { name: 'Members' })
    expect(sheet).toHaveAccessibleDescription('People in Night Owls')
    const members = within(sheet).getByRole('complementary', { name: 'Members' })
    expect(within(members).getByRole('region', { name: 'Online — 5' })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Members' })).not.toBeInTheDocument()
    expect(toggle).toHaveFocus()
  })
})
