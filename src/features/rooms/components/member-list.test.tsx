import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failOnConsoleError } from '@/test/console-guard'
import { nightOwls, raidNight, roomPath } from '@/test/fixtures/rooms'
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
  it('groups members into Owner — 1, Admins — 1 and Members — 5', async () => {
    await renderRoute(roomPath(nightOwls, 'general'))

    const members = screen.getByRole('complementary', { name: 'Members' })
    const owner = within(members).getByRole('region', { name: 'Owner — 1' })
    const admins = within(members).getByRole('region', { name: 'Admins — 1' })
    const regular = within(members).getByRole('region', { name: 'Members — 5' })
    expect(memberRow(owner, 'Arzl')).toBeInTheDocument()
    expect(memberRow(admins, 'Maya')).toBeInTheDocument()
    expect(
      within(regular)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['AAlex', 'JJun', 'PPriya', 'SSam', 'TTheo'])
  })

  it('leaves out empty groups', async () => {
    await renderRoute(roomPath(raidNight, 'lobby'))

    const members = screen.getByRole('complementary', { name: 'Members' })
    expect(within(members).getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'Owner — 1',
      'Admins — 1',
    ])
  })

  it('marks you with "(you)", once', async () => {
    await renderRoute(roomPath(nightOwls, 'general'))

    const members = screen.getByRole('complementary', { name: 'Members' })
    expect(memberRow(members, 'Arzl')).toHaveTextContent('(you)')
    expect(within(members).getAllByText('(you)')).toHaveLength(1)
  })

  it('hides and shows the panel with the members toggle, reflected by aria-pressed', async () => {
    const user = userEvent.setup()
    await renderRoute(roomPath(nightOwls, 'general'))

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
    await renderRoute(roomPath(nightOwls, 'general'))

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
    await renderRoute(roomPath(nightOwls, 'general'))

    expect(screen.queryByRole('complementary', { name: 'Members' })).not.toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Show members' })
    expect(toggle).not.toHaveAttribute('aria-pressed')

    await user.click(toggle)

    const sheet = await screen.findByRole('dialog', { name: 'Members' })
    expect(sheet).toHaveAccessibleDescription('People in Night Owls')
    const members = within(sheet).getByRole('complementary', { name: 'Members' })
    expect(within(members).getByRole('region', { name: 'Members — 5' })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Members' })).not.toBeInTheDocument()
    expect(toggle).toHaveFocus()
  })
})
