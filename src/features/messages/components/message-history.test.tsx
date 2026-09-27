import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { apiError } from '@/test/channels'
import { failOnConsoleError } from '@/test/console-guard'
import { makeMessage, messageId, people, todayAt } from '@/test/fixtures/messages'
import { channelOf, nightOwls, roomPath } from '@/test/fixtures/rooms'
import { messageHandlers } from '@/test/msw/messages'
import { recordRequests } from '@/test/msw/requests'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'
import type { Message } from '../types'

failOnConsoleError()

const generalId = channelOf(nightOwls, 'general').id
const MESSAGES = '*/api/channels/:channelId/messages'

/** `count` messages in #general by Maya, a minute apart, oldest first: "History 1".."History n". */
function history(count: number): Message[] {
  return Array.from({ length: count }, (_, index) =>
    makeMessage({
      id: messageId(200 + index),
      channelId: generalId,
      body: `History ${index + 1}`,
      createdAt: todayAt(10, index),
    }),
  )
}

/** Record the query string of every history GET, falling through to the installed handlers. */
function recordHistoryReads(respond: (params: URLSearchParams) => Response | undefined = () => undefined) {
  const reads: URLSearchParams[] = []
  server.use(
    http.get(MESSAGES, ({ request }) => {
      const params = new URL(request.url).searchParams
      reads.push(params)
      return respond(params)
    }),
  )
  return reads
}

function liveRegion(): HTMLElement {
  const region = document.querySelector<HTMLElement>('[aria-live="polite"]')
  if (!region) throw new Error('no polite live region')
  return region
}

function messageRow(log: HTMLElement, text: string) {
  const row = within(log).getByText(text, { exact: false }).closest<HTMLElement>('[role="article"]')
  if (!row) throw new Error(`No message row for "${text}"`)
  return row
}

describe('message history', () => {
  it('loads the newest page in the route loader, so the log is there on first render', async () => {
    server.use(...messageHandlers({ [generalId]: history(2) }))

    await renderRoute(roomPath(nightOwls, 'general'))

    const log = screen.getByRole('log', { name: 'Messages in #general' })
    expect(within(log).getByText('History 2')).toBeInTheDocument()
  })

  it('pages back through nextCursor to the start of the channel, without announcing old messages', async () => {
    server.use(...messageHandlers({ [generalId]: history(7) }, { pageSize: 3 }))
    const reads = recordHistoryReads()

    await renderRoute(roomPath(nightOwls, 'general'))
    const log = screen.getByRole('log', { name: 'Messages in #general' })

    expect(await within(log).findByText(/This is the start of #/)).toHaveTextContent(
      'This is the start of #general',
    )
    expect(
      within(log)
        .getAllByRole('article')
        .map((row) => row.textContent?.match(/History \d+/)?.[0]),
    ).toEqual(['History 1', 'History 2', 'History 3', 'History 4', 'History 5', 'History 6', 'History 7'])
    expect(reads.map((params) => params.get('cursor'))).toEqual([null, '3', '6'])
    await act(async () => {})
    expect(liveRegion().textContent).toBe('')
  })

  it('Home on a message loads older messages (here after auto-loading stopped on a failure)', async () => {
    // jsdom has no layout, so the log always sits "at the top" and older pages load on their
    // own; a failed older page stops that, leaving Home as the only trigger.
    server.use(...messageHandlers({ [generalId]: history(5) }, { pageSize: 3 }))
    let failOlder = true
    const reads = recordHistoryReads((params) =>
      failOlder && params.has('cursor') ? apiError(429, 'RATE_LIMITED', 'Slow down.') : undefined,
    )
    const user = userEvent.setup()
    await renderRoute(roomPath(nightOwls, 'general'))
    const log = screen.getByRole('log', { name: 'Messages in #general' })
    await within(log).findByText("Couldn't load older messages.")
    expect(reads).toHaveLength(2)

    failOlder = false
    act(() => messageRow(log, 'History 5').focus())
    await user.keyboard('{Home}')

    expect(await within(log).findByText('History 1')).toBeInTheDocument()
    expect(reads.map((params) => params.get('cursor'))).toEqual([null, '3', '3'])
    expect(within(log).getByText(/This is the start of #/)).toBeInTheDocument()
  })

  it('shows an inline Retry when an older page fails, and Retry loads it', async () => {
    server.use(...messageHandlers({ [generalId]: history(5) }, { pageSize: 3 }))
    let failOlder = true
    recordHistoryReads((params) =>
      failOlder && params.has('cursor') ? apiError(429, 'RATE_LIMITED', 'Slow down.') : undefined,
    )
    const user = userEvent.setup()

    await renderRoute(roomPath(nightOwls, 'general'))
    const log = screen.getByRole('log', { name: 'Messages in #general' })

    expect(await within(log).findByText("Couldn't load older messages.")).toBeInTheDocument()
    expect(within(log).getByText('History 5')).toBeInTheDocument()
    expect(within(log).queryByText('History 1')).not.toBeInTheDocument()

    failOlder = false
    await user.click(within(log).getByRole('button', { name: 'Retry' }))

    expect(await within(log).findByText('History 1')).toBeInTheDocument()
    expect(within(log).getByText(/This is the start of #/)).toBeInTheDocument()
    expect(within(log).queryByText("Couldn't load older messages.")).not.toBeInTheDocument()
  })

  it('offline on first load: says so, and Retry loads the history once back', async () => {
    server.use(...messageHandlers({ [generalId]: history(2) }))
    let offline = true
    recordHistoryReads(() => (offline ? HttpResponse.error() : undefined))
    const user = userEvent.setup()

    await renderRoute(roomPath(nightOwls, 'general'))

    expect(
      await screen.findByRole('heading', { level: 2, name: "Messages didn't load" }, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Couldn't reach Hideout. Check your connection and try again."),
    ).toBeInTheDocument()

    offline = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    const log = await screen.findByRole('log', { name: 'Messages in #general' })
    expect(within(log).getByText('History 2')).toBeInTheDocument()
  })

  it('a voice channel has no composer and never requests messages', async () => {
    const reads = recordRequests('get', MESSAGES)

    await renderRoute(roomPath(nightOwls, 'voice'))
    await act(async () => {})

    expect(screen.getByRole('heading', { level: 1, name: 'voice' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /^Message #/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('log')).not.toBeInTheDocument()
    expect(reads.count).toBe(0)
  })
})

describe('message rendering', () => {
  async function renderWith(messages: Message[]) {
    server.use(...messageHandlers({ [generalId]: messages }))
    const user = userEvent.setup()
    await renderRoute(roomPath(nightOwls, 'general'))
    const log = screen.getByRole('log', { name: 'Messages in #general' })
    return { user, log }
  }

  it('isolates the body in <bdi dir="auto"> and keeps its line breaks', async () => {
    const { log } = await renderWith([
      makeMessage({ channelId: generalId, body: 'line one\nline two', createdAt: todayAt(10, 0) }),
    ])

    const body = within(log).getByText(/line one/)
    expect(body.tagName).toBe('BDI')
    expect(body).toHaveAttribute('dir', 'auto')
    expect(body).toHaveClass('whitespace-pre-wrap')
    expect(body.textContent).toBe('line one\nline two')
  })

  it('renders HTML in a body as text, never as markup', async () => {
    const html = '<script>alert(1)</script><img src=x onerror=alert(2)><b>bold</b>'
    const { log } = await renderWith([
      makeMessage({ channelId: generalId, body: html, createdAt: todayAt(10, 0) }),
    ])

    expect(within(log).getByText(html)).toBeInTheDocument()
    expect(log.querySelector('script, img, b')).toBeNull()
  })

  it('links only http(s) URLs, as safe external links', async () => {
    const { log } = await renderWith([
      makeMessage({
        channelId: generalId,
        body: 'try javascript:alert(1) or https://example.com/a or ftp://example.com/b',
        createdAt: todayAt(10, 0),
      }),
    ])

    const links = within(log).getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://example.com/a')
    expect(links[0]).toHaveAttribute('target', '_blank')
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer nofollow')
  })

  it('shows "Deleted user" for a message whose author is gone', async () => {
    const { log } = await renderWith([
      makeMessage({ channelId: generalId, author: null, body: 'ghost', createdAt: todayAt(10, 0) }),
    ])

    expect(messageRow(log, 'ghost')).toHaveAccessibleName(/^Deleted user, /)
    expect(within(messageRow(log, 'ghost')).getByText('Deleted user')).toBeInTheDocument()
  })

  it('explains "(edited)" with the edit time in a tooltip', async () => {
    const { user, log } = await renderWith([
      makeMessage({
        channelId: generalId,
        author: people.alex,
        body: 'fixed typo',
        createdAt: todayAt(10, 0),
        editedAt: todayAt(10, 5),
      }),
    ])

    await user.hover(within(log).getByText('(edited)'))

    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent(/^Edited /)
    expect(tooltip.querySelector('time')).toHaveAttribute('dateTime', todayAt(10, 5))
  })

  it('announces a pending send and its failure through role="status"', async () => {
    const { user, log } = await renderWith(history(1))
    let fail = false
    let release!: () => void
    const held = new Promise<void>((resolve) => (release = resolve))
    server.use(
      http.post(MESSAGES, async () => {
        await held
        return fail ? apiError(500, 'INTERNAL', 'Boom.') : undefined
      }),
    )

    await user.type(screen.getByRole('textbox', { name: 'Message #general' }), 'hello{Enter}')
    const status = await within(log).findByRole('status')
    expect(status).toHaveTextContent('Sending…')

    fail = true
    release()

    await waitFor(() =>
      expect(within(log).getByRole('status')).toHaveTextContent(
        "Couldn't send. Something went wrong on our side. Try again. Retrying automatically.",
      ),
    )
  })
})
