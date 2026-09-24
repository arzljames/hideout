import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failOnConsoleError } from '@/test/console-guard'
import { renderRoute } from '@/test/render'
import { withViewportWidth } from '@/test/viewport'

failOnConsoleError()

async function renderInbox() {
  const user = userEvent.setup()
  const result = await renderRoute('/invites')
  return { user, ...result }
}

function rail() {
  return screen.getByRole('navigation', { name: 'Rooms' })
}

function inviteCards() {
  return screen.queryAllByRole('article')
}

/** Polite live regions (ours and sonner's) whose text includes `text`. */
function liveRegionsAnnouncing(text: string) {
  return Array.from(document.querySelectorAll<HTMLElement>('[aria-live="polite"]')).filter(
    (region) => region.textContent?.includes(text),
  )
}

describe('/invites route', () => {
  it('renders the inbox inside the app shell with one main and one h1', async () => {
    await renderInbox()

    expect(rail()).toBeInTheDocument()
    expect(screen.getAllByRole('main')).toHaveLength(1)
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent('Invites')
    expect(screen.getByText('3 pending')).toBeInTheDocument()
  })

  it('marks Invites as the current Home section, with its pending count', async () => {
    await renderInbox()

    const sections = screen.getByRole('navigation', { name: 'Home sections' })
    expect(within(sections).getByRole('link', { name: 'Invites 3 pending' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('shows the Home panel link without aria-current on /', async () => {
    await renderRoute('/')

    const sections = screen.getByRole('navigation', { name: 'Home sections' })
    expect(within(sections).getByRole('link', { name: 'Invites 3 pending' })).not.toHaveAttribute(
      'aria-current',
    )
  })
})

describe('InvitesInbox', () => {
  it('lists three invite cards, each named after its room', async () => {
    await renderInbox()

    const list = screen.getByRole('list', { name: 'Pending invites' })
    expect(within(list).getAllByRole('article')).toHaveLength(3)
    for (const room of ['Friday Night Raid', 'Co-op Sundays', 'Speedrun Lab']) {
      expect(screen.getByRole('article', { name: room })).toBeInTheDocument()
    }
  })

  it('says who invited you and when', async () => {
    await renderInbox()

    const card = screen.getByRole('article', { name: 'Friday Night Raid' })
    expect(card).toHaveTextContent('Theo invited you · 2 hours ago')
    expect(screen.getByRole('article', { name: 'Co-op Sundays' })).toHaveTextContent(
      'Priya invited you · Yesterday',
    )
  })

  it('names Accept and Decline after the room, with visible Accept/Decline text', async () => {
    await renderInbox()

    const card = screen.getByRole('article', { name: 'Friday Night Raid' })
    const accept = within(card).getByRole('button', { name: 'Accept invite to Friday Night Raid' })
    const decline = within(card).getByRole('button', { name: 'Decline invite to Friday Night Raid' })
    expect(accept).toHaveTextContent('Accept')
    expect(decline).toHaveTextContent('Decline')
  })

  it('accepting removes the card, toasts, announces, and focuses the next card', async () => {
    const { user } = await renderInbox()

    await user.click(screen.getByRole('button', { name: 'Accept invite to Friday Night Raid' }))

    expect(screen.queryByRole('article', { name: 'Friday Night Raid' })).not.toBeInTheDocument()
    expect(inviteCards()).toHaveLength(2)
    expect(await screen.findByText('Joined Friday Night Raid', { selector: '[data-title]' })).toBeInTheDocument()
    expect(liveRegionsAnnouncing('Joined Friday Night Raid').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: 'Accept invite to Co-op Sundays' })).toHaveFocus()
    expect(screen.getByText('2 pending')).toBeInTheDocument()
  })

  it('declining the last card focuses the previous card and announces it', async () => {
    const { user } = await renderInbox()

    await user.click(screen.getByRole('button', { name: 'Decline invite to Speedrun Lab' }))

    expect(screen.queryByRole('article', { name: 'Speedrun Lab' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept invite to Co-op Sundays' })).toHaveFocus()
    expect(liveRegionsAnnouncing('Declined invite to Speedrun Lab')).toHaveLength(1)
  })

  it('announces each decline, even two in a row', async () => {
    const { user } = await renderInbox()

    await user.click(screen.getByRole('button', { name: 'Decline invite to Speedrun Lab' }))
    expect(liveRegionsAnnouncing('Declined invite to Speedrun Lab')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Decline invite to Co-op Sundays' }))
    expect(liveRegionsAnnouncing('Declined invite to Co-op Sundays')).toHaveLength(1)
    expect(liveRegionsAnnouncing('Declined invite to Speedrun Lab')).toHaveLength(0)
  })

  it('declining a middle card focuses the next one', async () => {
    const { user } = await renderInbox()

    await user.click(screen.getByRole('button', { name: 'Decline invite to Co-op Sundays' }))

    expect(screen.getByRole('button', { name: 'Accept invite to Speedrun Lab' })).toHaveFocus()
  })

  it('shows "No pending invites" with focus on its heading once the list is empty', async () => {
    const { user } = await renderInbox()

    await user.click(screen.getByRole('button', { name: 'Accept invite to Friday Night Raid' }))
    await user.click(screen.getByRole('button', { name: 'Decline invite to Co-op Sundays' }))
    await user.click(screen.getByRole('button', { name: 'Decline invite to Speedrun Lab' }))

    const heading = screen.getByRole('heading', { name: 'No pending invites' })
    expect(heading).toHaveFocus()
    expect(heading).toHaveAttribute('tabindex', '-1')
    expect(screen.getByText('When someone invites you to a room, it shows up here.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Pending invites' })).not.toBeInTheDocument()
    expect(screen.queryByText(/\d+ pending$/)).not.toBeInTheDocument()
    // Still exactly one h1 on the page.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('keeps the rail Home label and the Invites badge in step with the count', async () => {
    const { user } = await renderInbox()
    const sections = screen.getByRole('navigation', { name: 'Home sections' })

    expect(within(rail()).getByRole('link', { name: 'Home, 3 pending invites' })).toHaveTextContent('3')
    expect(within(sections).getByRole('link', { name: 'Invites 3 pending' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Accept invite to Friday Night Raid' }))
    expect(within(rail()).getByRole('link', { name: 'Home, 2 pending invites' })).toHaveTextContent('2')
    expect(within(sections).getByRole('link', { name: 'Invites 2 pending' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Decline invite to Co-op Sundays' }))
    expect(within(rail()).getByRole('link', { name: 'Home, 1 pending invite' })).toHaveTextContent('1')

    await user.click(screen.getByRole('button', { name: 'Decline invite to Speedrun Lab' }))
    const home = within(rail()).getByRole('link', { name: 'Home' })
    expect(home).toHaveTextContent('')
    expect(within(sections).getByRole('link', { name: 'Invites' })).toHaveTextContent(/^Invites$/)
  })

  it('keeps the counts after navigating away and back', async () => {
    const { user } = await renderInbox()

    await user.click(screen.getByRole('button', { name: 'Accept invite to Friday Night Raid' }))
    await user.click(within(rail()).getByRole('link', { name: 'Night Owls' }))
    await screen.findByRole('heading', { level: 1, name: 'general' })

    expect(within(rail()).getByRole('link', { name: 'Home, 2 pending invites' })).toBeInTheDocument()
  })

  // sonner's toaster is itself a polite live region; the inbox's own region must not repeat the join.
  it('announces an accepted invite once', async () => {
    const { user } = await renderInbox()

    await user.click(screen.getByRole('button', { name: 'Accept invite to Friday Night Raid' }))
    await screen.findByText('Joined Friday Night Raid', { selector: '[data-title]' })

    expect(liveRegionsAnnouncing('Joined Friday Night Raid')).toHaveLength(1)
  })
})

describe('InvitesInbox on mobile', () => {
  withViewportWidth(500)

  it('still accepts invites and moves focus to the next card', async () => {
    const { user } = await renderInbox()

    expect(screen.queryByRole('navigation', { name: 'Rooms' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Accept invite to Friday Night Raid' }))

    expect(inviteCards()).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Accept invite to Co-op Sundays' })).toHaveFocus()

    // The rail in the navigation sheet reflects the new count.
    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    const nav = await screen.findByRole('dialog', { name: 'Navigation' })
    expect(within(nav).getByRole('link', { name: 'Home, 2 pending invites' })).toBeInTheDocument()
  })
})
