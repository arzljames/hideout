import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { apiError } from '@/test/channels'
import { failOnConsoleError } from '@/test/console-guard'
import { generalMessages, makeMessage } from '@/test/fixtures/messages'
import { channelOf, nightOwls, roomPath } from '@/test/fixtures/rooms'
import { messageHandlers, sentMessage } from '@/test/msw/messages'
import { gateRequests, recordRequests } from '@/test/msw/requests'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'
import { RETRY_DELAYS_MS } from '../message-sender'

failOnConsoleError()

const generalId = channelOf(nightOwls, 'general').id
const POSTS = '*/api/channels/:channelId/messages'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function renderGeneral() {
  server.use(...messageHandlers({ [generalId]: generalMessages }))
  const user = userEvent.setup()
  const result = await renderRoute(roomPath(nightOwls, 'general'))
  const log = await screen.findByRole('log', { name: 'Messages in #general' })
  await within(log).findByText('Same, joining now')
  const composer = screen.getByRole('textbox', { name: 'Message #general' })
  return { ...result, user, log, composer }
}

/** Record each POST's Idempotency-Key, answering with `respond` (undefined: fall through). */
function recordKeys(respond: (n: number) => Response | undefined = () => undefined) {
  const keys: (string | null)[] = []
  server.use(
    http.post(POSTS, ({ request }) => {
      keys.push(request.headers.get('Idempotency-Key'))
      return respond(keys.length)
    }),
  )
  return keys
}

/** The article (a sent message) holding `text`, or null. */
function sentRow(log: HTMLElement, text: string) {
  return within(log).queryByText(text)?.closest('[role="article"]') ?? null
}

function liveRegion(): HTMLElement {
  const region = document.querySelector<HTMLElement>('[aria-live="polite"]')
  if (!region) throw new Error('no polite live region')
  return region
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('sending a message', () => {
  it('shows the message as "Sending…" at once, then as a sent message', async () => {
    const { user, log, composer } = await renderGeneral()
    const gate = gateRequests('post', POSTS)

    await user.type(composer, 'on my way{Enter}')

    expect(await within(log).findByRole('status')).toHaveTextContent('Sending…')
    expect(within(log).getByText('on my way')).toBeInTheDocument()
    expect(sentRow(log, 'on my way')).toBeNull()

    gate.releaseAll()

    await waitFor(() => expect(sentRow(log, 'on my way')).not.toBeNull())
    expect(sentRow(log, 'on my way')).toHaveAccessibleName(/^Arzl, /)
    expect(screen.queryByText('Sending…')).not.toBeInTheDocument()
    expect(within(log).getAllByText('on my way')).toHaveLength(1)
  })

  it('posts the body exactly as typed, without trimming', async () => {
    const { user, composer } = await renderGeneral()
    const posts = recordRequests('post', POSTS)

    await user.type(composer, '  gg  {Shift>}{Enter}{/Shift}{Enter}')

    await vi.waitFor(() => expect(posts.bodies).toEqual([{ body: '  gg  \n' }]))
  })

  it('sends a UUID Idempotency-Key, a different one per message', async () => {
    const { user, log, composer } = await renderGeneral()
    const keys = recordKeys()

    await user.type(composer, 'one{Enter}')
    await user.type(composer, 'two{Enter}')

    await vi.waitFor(() => expect(sentRow(log, 'two')).not.toBeNull())
    expect(keys).toHaveLength(2)
    expect(keys[0]).toMatch(UUID)
    expect(keys[1]).toMatch(UUID)
    expect(keys[1]).not.toBe(keys[0])
  })

  it('treats 200 Idempotent-Replayed as sent, showing one message', async () => {
    const { user, log, composer } = await renderGeneral()
    server.use(
      http.post(POSTS, () =>
        HttpResponse.json(sentMessage(generalId, 'replayed'), {
          status: 200,
          headers: { 'Idempotent-Replayed': 'true' },
        }),
      ),
    )

    await user.type(composer, 'replayed{Enter}')

    await vi.waitFor(() => expect(sentRow(log, 'replayed')).not.toBeNull())
    expect(within(log).getAllByText('replayed')).toHaveLength(1)
    expect(within(log).queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText(/Couldn't send/)).not.toBeInTheDocument()
  })

  it('on 409 IDEMPOTENCY_KEY_REUSED, posts once more with a new key', async () => {
    const { user, log, composer } = await renderGeneral()
    const keys = recordKeys((n) =>
      n === 1 ? apiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Key reused.') : undefined,
    )

    await user.type(composer, 'fresh key{Enter}')

    await vi.waitFor(() => expect(sentRow(log, 'fresh key')).not.toBeNull())
    expect(keys).toHaveLength(2)
    expect(keys[1]).toMatch(UUID)
    expect(keys[1]).not.toBe(keys[0])
    expect(screen.queryByText(/Couldn't send/)).not.toBeInTheDocument()
  })

  it('on 429, shows the failure and retries automatically after the backoff with the same key', async () => {
    const { log, composer } = await renderGeneral()
    // Only setTimeout is faked (the sender's backoff timer); shouldAdvanceTime keeps React,
    // MSW and user-event moving.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
    const keys = recordKeys((n) => (n === 1 ? apiError(429, 'RATE_LIMITED', 'Slow down.') : undefined))

    await user.type(composer, 'patience{Enter}')

    await vi.waitFor(() =>
      expect(within(log).getByRole('status')).toHaveTextContent(
        "Couldn't send. You're sending too fast. Wait a moment and try again. Retrying automatically.",
      ),
    )
    expect(keys).toHaveLength(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0] - 500)
    })
    expect(keys).toHaveLength(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    await vi.waitFor(() => expect(sentRow(log, 'patience')).not.toBeNull())
    expect(keys).toHaveLength(2)
    expect(keys[0]).toMatch(UUID)
    expect(keys[1]).toBe(keys[0])
    expect(within(log).queryByRole('status')).not.toBeInTheDocument()
  })

  it('while offline, waits for the browser to come back online, then resends with the same key', async () => {
    const { user, log, composer } = await renderGeneral()
    let online = false
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })
    const keys = recordKeys(() => (online ? undefined : HttpResponse.error()))

    try {
      await user.type(composer, 'from the tunnel{Enter}')

      await vi.waitFor(() =>
        expect(within(log).getByRole('status')).toHaveTextContent(
          "Couldn't send. Couldn't reach Hideout. Check your connection and try again. Retrying automatically.",
        ),
      )
      expect(keys).toHaveLength(1)

      online = true
      act(() => {
        window.dispatchEvent(new Event('online'))
      })

      await waitFor(() => expect(sentRow(log, 'from the tunnel')).not.toBeNull())
      expect(keys).toHaveLength(2)
      expect(keys[1]).toBe(keys[0])
    } finally {
      // Back to jsdom's own (prototype) getter.
      delete (navigator as { onLine?: boolean }).onLine
    }
  })

  it('on 422, shows the API reason for the body and does not retry automatically', async () => {
    const { user, log, composer } = await renderGeneral()
    const keys = recordKeys(() =>
      apiError(422, 'VALIDATION_FAILED', 'Invalid body.', [
        { path: 'body.body', message: 'Too many zalgo marks.' },
      ]),
    )

    await user.type(composer, 'z{Enter}')

    const status = await within(log).findByRole('status')
    await vi.waitFor(() => expect(status).toHaveTextContent("Couldn't send. Too many zalgo marks."))
    expect(status).not.toHaveTextContent('Retrying automatically')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(keys).toHaveLength(1)
  })

  it('Discard removes a failed message', async () => {
    const { user, log, composer } = await renderGeneral()
    recordKeys(() => apiError(403, 'ORIGIN_NOT_ALLOWED', 'Nope.'))

    await user.type(composer, 'never mind{Enter}')
    await screen.findByText(/Couldn't send/)

    await user.click(screen.getByRole('button', { name: 'Discard' }))

    expect(within(log).queryByText('never mind')).not.toBeInTheDocument()
    expect(within(log).queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('keeps an unsent draft per channel when switching channels and back', async () => {
    const { user, router, composer } = await renderGeneral()

    await user.type(composer, 'half a thought')

    act(() => {
      void router.navigate({ to: roomPath(nightOwls, 'clips') })
    })
    expect(await screen.findByRole('textbox', { name: 'Message #clips' })).toHaveValue('')

    act(() => {
      void router.navigate({ to: roomPath(nightOwls, 'general') })
    })
    expect(await screen.findByRole('textbox', { name: 'Message #general' })).toHaveValue(
      'half a thought',
    )
  })

  it('does not announce your own message in the live region', async () => {
    // History from an hour ago, so the sent message (created now) is the newest.
    const anHourAgo = new Date(Date.now() - 60 * 60_000).toISOString()
    server.use(
      ...messageHandlers({
        [generalId]: [makeMessage({ channelId: generalId, body: 'earlier', createdAt: anHourAgo })],
      }),
    )
    const user = userEvent.setup()
    await renderRoute(roomPath(nightOwls, 'general'))
    const log = screen.getByRole('log', { name: 'Messages in #general' })

    await user.type(screen.getByRole('textbox', { name: 'Message #general' }), 'quietly{Enter}')

    await waitFor(() => expect(sentRow(log, 'quietly')).not.toBeNull())
    await act(async () => {})
    expect(liveRegion().textContent).toBe('')
  })
})
