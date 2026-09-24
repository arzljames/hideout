import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failOnConsoleError } from '@/test/console-guard'
import { renderRoute } from '@/test/render'

failOnConsoleError()

async function renderGeneral() {
  const user = userEvent.setup()
  await renderRoute('/rooms/night-owls/general')
  const log = screen.getByRole('log', { name: 'Messages in #general' })
  return { user, log }
}

/** The message row (an article in the log) holding `text`. */
function messageRow(log: HTMLElement, text: string) {
  const row = within(log).getByText(text, { exact: false }).closest<HTMLElement>('[role="article"]')
  if (!row) throw new Error(`No message row for "${text}"`)
  return row
}

/** Rows that are currently in the tab order. */
function tabStops(log: HTMLElement) {
  return within(log)
    .getAllByRole('article')
    .filter((row) => row.getAttribute('tabindex') === '0')
}

describe('MessageList in #general', () => {
  it('is a polite live log labelled with the channel', async () => {
    const { log } = await renderGeneral()

    expect(log).toHaveAttribute('aria-live', 'polite')
  })

  it('starts the day with a "Today" divider', async () => {
    const { log } = await renderGeneral()

    expect(within(log).getByRole('separator', { name: 'Today' })).toBeInTheDocument()
  })

  it("groups Maya's two consecutive messages under one author header", async () => {
    const { log } = await renderGeneral()

    // One visible "Maya" header for both lines.
    expect(within(log).getAllByText('Maya', { exact: true })).toHaveLength(1)
    const first = messageRow(log, 'Anyone up for a couple of runs after dinner?')
    const second = messageRow(log, 'I still need the bell bearing from the catacombs.')
    expect(within(first).getByText('Maya', { exact: true })).toBeInTheDocument()
    expect(within(first).getByText('Maya', { exact: true }).closest('p')?.querySelector('time')).not.toBeNull()
    // The continuation line has no visible header but still names the author for screen readers.
    expect(within(second).queryByText('Maya', { exact: true })).not.toBeInTheDocument()
    expect(second).toHaveTextContent(/^Maya, .+:I still need the bell bearing/)
  })

  it('gives each new author their own header', async () => {
    const { log } = await renderGeneral()

    for (const name of ['Maya', 'Alex', 'Jun', 'Arzl']) {
      expect(within(log).getAllByText(name, { exact: true })).toHaveLength(1)
    }
  })

  it("marks Arzl's message as (edited)", async () => {
    const { log } = await renderGeneral()

    expect(within(log).getAllByText('(edited)')).toHaveLength(1)
    expect(messageRow(log, 'Same, joining now')).toContainElement(within(log).getByText('(edited)'))
  })

  it('renders the Steam URL as a safe external link and keeps the text around it', async () => {
    const { log } = await renderGeneral()

    const url = 'https://steamcommunity.com/sharedfiles/filedetails/?id=2951'
    const link = within(log).getByRole('link', { name: url })
    expect(link).toHaveAttribute('href', url)
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow')
    expect(link).toHaveAttribute('target', '_blank')
    expect(messageRow(log, 'This is the route I was talking about:')).toContainElement(link)
    expect(within(log).getAllByRole('link')).toHaveLength(1)
  })

  it('shows Edit and Delete only on your own message', async () => {
    const { log } = await renderGeneral()

    const edits = within(log).getAllByRole('button', { name: 'Edit message' })
    const deletes = within(log).getAllByRole('button', { name: 'Delete message' })
    expect(edits).toHaveLength(1)
    expect(deletes).toHaveLength(1)
    const own = messageRow(log, 'Same, joining now')
    expect(own).toContainElement(edits[0] ?? null)
    expect(own).toContainElement(deletes[0] ?? null)
  })

  it('opens Edit and Delete in a context menu when you right-click your own message', async () => {
    const { user, log } = await renderGeneral()

    await user.pointer({ keys: '[MouseRight]', target: messageRow(log, 'Same, joining now') })

    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Edit message',
      'Delete message',
    ])

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it("does not open a context menu on someone else's message", async () => {
    const { user, log } = await renderGeneral()

    await user.pointer({ keys: '[MouseRight]', target: messageRow(log, 'In. Give me 20 minutes.') })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('names each message by author and time', async () => {
    const { log } = await renderGeneral()

    const rows = within(log).getAllByRole('article')
    expect(rows).toHaveLength(6)
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      expect.stringMatching(/^Maya, \d{1,2}:41/),
      expect.stringMatching(/^Maya, \d{1,2}:41/),
      expect.stringMatching(/^Alex, \d{1,2}:44/),
      expect.stringMatching(/^Alex, \d{1,2}:44/),
      expect.stringMatching(/^Jun, \d{1,2}:52/),
      expect.stringMatching(/^Arzl, \d{1,2}:53/),
    ])
  })

  it('is a single tab stop, held by the newest message at first', async () => {
    const { log } = await renderGeneral()

    expect(tabStops(log)).toEqual([messageRow(log, 'Same, joining now')])
    // The own-message toolbar is reached with arrow keys, not Tab.
    for (const button of within(log).getAllByRole('button')) {
      expect(button).toHaveAttribute('tabindex', '-1')
    }
  })

  it('moves between messages with ArrowUp/ArrowDown and jumps with Home/End', async () => {
    const { user, log } = await renderGeneral()
    const newest = messageRow(log, 'Same, joining now')
    act(() => newest.focus())

    await user.keyboard('{ArrowUp}')
    const jun = messageRow(log, 'Just wrapped a deep dive.')
    expect(jun).toHaveFocus()
    expect(tabStops(log)).toEqual([jun])

    await user.keyboard('{Home}')
    expect(messageRow(log, 'Anyone up for a couple of runs after dinner?')).toHaveFocus()

    await user.keyboard('{ArrowUp}')
    expect(messageRow(log, 'Anyone up for a couple of runs after dinner?')).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(messageRow(log, 'I still need the bell bearing from the catacombs.')).toHaveFocus()

    await user.keyboard('{End}')
    expect(newest).toHaveFocus()
  })

  it('leaves the log for the composer with a single Tab', async () => {
    const { user, log } = await renderGeneral()
    act(() => messageRow(log, 'In. Give me 20 minutes.').focus())

    await user.tab()

    expect(screen.getByRole('textbox', { name: 'Message #general' })).toHaveFocus()
  })

  it('reaches your own message actions with ArrowRight and returns with Escape', async () => {
    const { user, log } = await renderGeneral()
    const own = messageRow(log, 'Same, joining now')
    expect(own).toHaveAccessibleDescription('Press Right Arrow for message actions.')
    act(() => own.focus())

    await user.keyboard('{ArrowRight}')
    const toolbar = within(own).getByRole('toolbar', { name: 'Message actions' })
    expect(within(toolbar).getByRole('button', { name: 'Edit message' })).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(within(toolbar).getByRole('button', { name: 'Delete message' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(own).toHaveFocus()
  })

  it("does nothing on ArrowRight on someone else's message", async () => {
    const { user, log } = await renderGeneral()
    const alex = messageRow(log, 'In. Give me 20 minutes.')
    act(() => alex.focus())

    await user.keyboard('{ArrowRight}')

    expect(alex).toHaveFocus()
  })

  it('shows "Alex is typing…" in a live region', async () => {
    await renderGeneral()

    const typing = screen.getByText(/is typing/)
    expect(typing).toHaveTextContent('Alex is typing…')
    expect(typing.closest('[aria-live="polite"]')).not.toBeNull()
  })
})
